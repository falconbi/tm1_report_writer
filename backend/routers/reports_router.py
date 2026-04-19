import json
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from db.database import get_session
from db.models import Report, ReportVersion, AuditLog
from services.dataset_service import fetch_dataset

router = APIRouter(prefix="/api/reports", tags=["Reports"])


# ─── Dataset ──────────────────────────────────────────────────────────────────


@router.get("/dataset")
async def get_dataset(
    cube: str = Query(...),
    view: str = Query(...),
    overrides: str = Query("{}"),
):
    try:
        data = fetch_dataset(cube, view, {"overrides": overrides})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── List reports ─────────────────────────────────────────────────────────────


@router.get("/list")
async def list_reports(session: Session = Depends(get_session)):
    reports = session.exec(select(Report).order_by(Report.updated_at.desc())).all()
    return {
        "reports": [
            {
                "id": r.id,
                "title": r.title,
                "type": r.type,
                "status": r.status,
                "hasDraft": r.has_draft,
                "everPublished": r.published_at is not None,
                "folderId": r.folder_id,
                "owner": r.owner,
                "updatedAt": r.updated_at.isoformat(),
                "publishedAt": r.published_at.isoformat() if r.published_at else None,
                "lastDatasetAt": r.last_dataset_at.isoformat() if r.last_dataset_at else None,
            }
            for r in reports
        ]
    }


# ─── Get published report with data ───────────────────────────────────────────


@router.get("/definitions/{report_id}")
async def get_definition(
    report_id: str,
    published: bool = Query(False),
    session: Session = Depends(get_session),
):
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    if (
        published
        and report.published_definition
        and report.published_definition != "{}"
    ):
        definition = json.loads(report.published_definition)
        # Prefer published_dataset snapshot, fall back to last_dataset, then live fetch
        raw_ds = report.published_dataset if report.published_dataset and report.published_dataset != "{}" else None
        data_as_of = report.published_at.isoformat() if report.published_at else None
        if raw_ds:
            dataset = json.loads(raw_ds)
        else:
            raw_last = report.last_dataset if report.last_dataset and report.last_dataset != "{}" else None
            if raw_last:
                dataset = json.loads(raw_last)
                data_as_of = report.last_dataset_at.isoformat() if report.last_dataset_at else data_as_of
            else:
                # No snapshot exists — fetch live as fallback (report pre-dates snapshot feature)
                cube = definition.get("cube")
                view = definition.get("view")
                try:
                    dataset = fetch_dataset(cube, view, {}) if cube and view else None
                except Exception:
                    dataset = None
        return {
            "id": report_id,
            "title": definition.get("title", report.title),
            "definition": definition,
            "dataset": dataset,
            "dataAsOf": data_as_of,
        }
    raw_ds = report.last_dataset if report.last_dataset and report.last_dataset != "{}" else None
    return {
        "id": report_id,
        "title": report.title,
        "definition": report.get_definition(),
        "dataset": json.loads(raw_ds) if raw_ds else None,
        "lastDatasetAt": report.last_dataset_at.isoformat() if report.last_dataset_at else None,
    }


# ─── Persist dataset snapshot (called after explicit Refresh in builder) ──────


class DatasetPayload(BaseModel):
    dataset: dict


@router.post("/definitions/{report_id}/dataset")
async def save_dataset(
    report_id: str,
    payload: DatasetPayload,
    session: Session = Depends(get_session),
):
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    report.last_dataset = json.dumps(payload.dataset)
    report.last_dataset_at = datetime.now(timezone.utc)
    session.add(report)
    session.commit()
    return {"status": "ok"}


# ─── Save draft ───────────────────────────────────────────────────────────────


class DefinitionPayload(BaseModel):
    definition: dict[str, Any]


@router.post("/definitions/{report_id}/draft")
async def save_draft(
    report_id: str,
    payload: DefinitionPayload,
    session: Session = Depends(get_session),
):
    now = datetime.now(timezone.utc)
    data = payload.definition
    data["id"] = report_id

    report = session.get(Report, report_id)
    if report:
        report.title = data.get("title", report.title)
        report.has_draft = True
        if report.status != "published":
            report.status = "draft"
        report.updated_at = now
        report.set_definition(data)
    else:
        report = Report(
            id=report_id,
            title=data.get("title", "Untitled"),
            type=data.get("pageType", "report"),
            status="draft",
            has_draft=True,
            created_at=now,
            updated_at=now,
        )
        report.set_definition(data)

    session.add(report)

    # Audit
    session.add(
        AuditLog(
            action="save_draft",
            target_type="report",
            target_id=report_id,
            target_title=report.title,
            timestamp=now,
        )
    )

    session.commit()
    return {"status": "saved", "id": report_id}


# ─── Publish ──────────────────────────────────────────────────────────────────


@router.post("/definitions/{report_id}/publish")
async def publish_definition(
    report_id: str,
    payload: DefinitionPayload,
    session: Session = Depends(get_session),
):
    now = datetime.now(timezone.utc)
    data = payload.definition
    data["id"] = report_id
    data["publishedAt"] = now.isoformat()

    report = session.get(Report, report_id)
    if not report:
        report = Report(
            id=report_id,
            created_at=now,
        )

    # Archive current published version before overwriting
    if report.status == "published":
        version = ReportVersion(
            report_id=report_id,
            published_at=report.published_at or now,
            definition=report.definition,
        )
        session.add(version)

    report.title = data.get("title", report.title)
    report.type = data.get("pageType", "report")
    report.status = "published"
    report.has_draft = False
    report.updated_at = now
    report.published_at = now
    report.published_definition = json.dumps(data)
    report.set_definition(data)

    # Snapshot TM1 dataset at publish time — viewer will use this, never fetches live
    cube = data.get("cube")
    view = data.get("view")
    if cube and view:
        try:
            ds = fetch_dataset(cube, view, {"overrides": data.get("context", {})})
            report.published_dataset = json.dumps(ds)
        except Exception:
            pass  # Leave existing snapshot intact if TM1 is unreachable

    session.add(report)

    # Audit
    session.add(
        AuditLog(
            action="publish",
            target_type="report",
            target_id=report_id,
            target_title=report.title,
            timestamp=now,
        )
    )

    session.commit()
    return {"status": "published", "id": report_id}


# ─── Get version history ──────────────────────────────────────────────────────


@router.get("/definitions/{report_id}/history")
async def get_history(report_id: str, session: Session = Depends(get_session)):
    versions = session.exec(
        select(ReportVersion)
        .where(ReportVersion.report_id == report_id)
        .order_by(ReportVersion.published_at.desc())
    ).all()
    return {
        "versions": [
            {
                "id": v.id,
                "publishedAt": v.published_at.isoformat(),
                "publishedBy": v.published_by,
            }
            for v in versions
        ]
    }


@router.get("/definitions/{report_id}/history/{version_id}")
async def get_version(
    report_id: str,
    version_id: int,
    session: Session = Depends(get_session),
):
    version = session.get(ReportVersion, version_id)
    if not version or version.report_id != report_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return version.get_definition()


# ─── Delete ───────────────────────────────────────────────────────────────────


@router.delete("/definitions/{report_id}")
async def delete_definition(
    report_id: str,
    session: Session = Depends(get_session),
):
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")

    session.add(
        AuditLog(
            action="delete",
            target_type="report",
            target_id=report_id,
            target_title=report.title,
        )
    )

    session.delete(report)
    session.commit()
    return {"status": "deleted", "id": report_id}


# ─── Audit log ────────────────────────────────────────────────────────────────


@router.get("/audit")
async def get_audit_log(
    limit: int = Query(50),
    session: Session = Depends(get_session),
):
    logs = session.exec(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    ).all()
    return {
        "log": [
            {
                "id": l.id,
                "user": l.user,
                "action": l.action,
                "targetType": l.target_type,
                "targetId": l.target_id,
                "targetTitle": l.target_title,
                "timestamp": l.timestamp.isoformat(),
                "detail": l.detail,
            }
            for l in logs
        ]
    }


# ─── Move to folder ────────────────────────────────────────────────────────────


class FolderPayload(BaseModel):
    folderId: Optional[str]


@router.post("/{report_id}/folder")
async def move_report_to_folder(
    report_id: str,
    payload: FolderPayload,
    session: Session = Depends(get_session),
):
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    report.folder_id = payload.folderId
    session.add(report)
    session.commit()
    return {"status": "ok"}
