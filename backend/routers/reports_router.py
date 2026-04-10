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
                "id":            r.id,
                "title":         r.title,
                "type":          r.type,
                "status":        r.status,
                "hasDraft":      r.has_draft,
                "everPublished": r.published_at is not None,
                "isConfirmed":   r.is_confirmed,
                "confirmedAt":   r.confirmed_at.isoformat() if r.confirmed_at else None,
                "confirmedBy":   r.confirmed_by,
                "folderId":      r.folder_id,
                "owner":         r.owner,
                "updatedAt":     r.updated_at.isoformat(),
                "publishedAt":   r.published_at.isoformat() if r.published_at else None,
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
    if published and report.published_definition and report.published_definition != "{}":
        definition = json.loads(report.published_definition)
        dataset = None
        if definition.get('cube') and definition.get('view'):
            try:
                dataset = fetch_dataset(definition['cube'], definition['view'], {"overrides": definition.get('context', {})})
            except:
                pass
        return {"id": report_id, "title": definition.get('title', report.title), "definition": definition, "dataset": dataset}
    return {"id": report_id, "title": report.title, "definition": report.get_definition(), "dataset": None}


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
        report.title        = data.get("title", report.title)
        report.has_draft    = True
        report.is_confirmed = False  # definition changed — confirmation is stale
        # Only flip to draft if never published
        if report.status != "published":
            report.status = "draft"
        report.updated_at = now
        report.set_definition(data)
    else:
        report = Report(
            id         = report_id,
            title      = data.get("title", "Untitled"),
            type       = data.get("pageType", "report"),
            status     = "draft",
            has_draft  = True,
            created_at = now,
            updated_at = now,
        )
        report.set_definition(data)

    session.add(report)

    # Audit
    session.add(AuditLog(
        action       = "save_draft",
        target_type  = "report",
        target_id    = report_id,
        target_title = report.title,
        timestamp    = now,
    ))

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
            id         = report_id,
            created_at = now,
        )

    # Archive current published version before overwriting
    if report.status == "published":
        version = ReportVersion(
            report_id    = report_id,
            published_at = report.published_at or now,
            definition   = report.definition,
        )
        session.add(version)

    report.title                = data.get("title", report.title)
    report.type                 = data.get("pageType", "report")
    report.status               = "published"
    report.has_draft            = False
    report.updated_at           = now
    report.published_at         = now
    report.published_definition = json.dumps(data)
    report.set_definition(data)

    session.add(report)

    # Audit
    session.add(AuditLog(
        action       = "publish",
        target_type  = "report",
        target_id    = report_id,
        target_title = report.title,
        timestamp    = now,
    ))

    session.commit()
    return {"status": "published", "id": report_id}


# ─── Confirm data ────────────────────────────────────────────────────────────

class ConfirmPayload(BaseModel):
    selectors: dict[str, str] = {}  # { dimension: selected_member }

@router.post("/definitions/{report_id}/confirm")
async def confirm_data(
    report_id: str,
    payload: ConfirmPayload,
    session: Session = Depends(get_session),
):
    now = datetime.now(timezone.utc)
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")

    report.is_confirmed        = True
    report.confirmed_at        = now
    report.confirmed_by        = "builder"   # replaced by real user once auth is in
    report.confirmed_selectors = json.dumps(payload.selectors)

    session.add(report)
    session.add(AuditLog(
        action       = "confirm_data",
        target_type  = "report",
        target_id    = report_id,
        target_title = report.title,
        timestamp    = now,
        detail       = json.dumps(payload.selectors),
    ))
    session.commit()
    return {
        "status":      "confirmed",
        "confirmedAt": now.isoformat(),
        "confirmedBy": "builder",
    }


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
                "id":          v.id,
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

    session.add(AuditLog(
        action       = "delete",
        target_type  = "report",
        target_id    = report_id,
        target_title = report.title,
    ))

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
        select(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
    ).all()
    return {
        "log": [
            {
                "id":          l.id,
                "user":        l.user,
                "action":      l.action,
                "targetType":  l.target_type,
                "targetId":    l.target_id,
                "targetTitle": l.target_title,
                "timestamp":   l.timestamp.isoformat(),
                "detail":      l.detail,
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
