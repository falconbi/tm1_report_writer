import json
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from db.database import get_session
from db.models import Pack, PackVersion, Report, Note, Visual, AuditLog

router = APIRouter(prefix="/api/packs", tags=["Packs"])


# ─── List packs ───────────────────────────────────────────────────────────────

@router.get("/list")
async def list_packs(session: Session = Depends(get_session)):
    packs = session.exec(select(Pack).order_by(Pack.updated_at.desc())).all()
    return {
        "packs": [
            {
                "id":          p.id,
                "name":        p.name,
                "description": p.description,
                "status":      p.status,
                "hasDraft":    p.has_draft,
                "folderId":    p.folder_id,
                "owner":       p.owner,
                "statements":  p.get_statements(),
                "layout":      p.get_layout(),
                "updatedAt":   p.updated_at.isoformat(),
                "publishedAt": p.published_at.isoformat() if p.published_at else None,
            }
            for p in packs
        ]
    }


# ─── Get pack ─────────────────────────────────────────────────────────────────

@router.get("/{pack_id}")
async def get_pack(pack_id: str, session: Session = Depends(get_session)):
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")
    return {
        "id":          pack.id,
        "name":        pack.name,
        "description": pack.description,
        "status":      pack.status,
        "owner":       pack.owner,
        "statements":  pack.get_statements(),
        "layout":      pack.get_layout(),
        "updatedAt":   pack.updated_at.isoformat(),
        "publishedAt": pack.published_at.isoformat() if pack.published_at else None,
    }


# ─── Save pack (draft) ────────────────────────────────────────────────────────

class PackPayload(BaseModel):
    name: str
    description: str = ""
    statements: list[str] = []
    layout: list[Any] = []

@router.post("/{pack_id}/draft")
async def save_pack_draft(
    pack_id: str,
    payload: PackPayload,
    session: Session = Depends(get_session),
):
    now = datetime.now(timezone.utc)
    pack = session.get(Pack, pack_id)

    if pack:
        pack.name        = payload.name
        pack.description = payload.description
        pack.updated_at  = now
        pack.has_draft   = True
        # Only flip to draft if never published
        if pack.status != "published":
            pack.status = "draft"
        pack.set_statements(payload.statements)
        pack.set_layout(payload.layout)
    else:
        pack = Pack(
            id          = pack_id,
            name        = payload.name,
            description = payload.description,
            status      = "draft",
            has_draft   = True,
            created_at  = now,
            updated_at  = now,
        )
        pack.set_statements(payload.statements)
        pack.set_layout(payload.layout)

    session.add(pack)
    session.add(AuditLog(
        action       = "save_draft",
        target_type  = "pack",
        target_id    = pack_id,
        target_title = pack.name,
        timestamp    = now,
    ))
    session.commit()
    return {"status": "saved", "id": pack_id}


# ─── Publish pack ─────────────────────────────────────────────────────────────

@router.post("/{pack_id}/publish")
async def publish_pack(
    pack_id: str,
    payload: PackPayload,
    session: Session = Depends(get_session),
):
    now = datetime.now(timezone.utc)

    # Validate all artifacts in statements are published + confirmed
    not_published = []
    not_confirmed = []
    for artifact_id in payload.statements:
        report = session.get(Report, artifact_id)
        if report is not None:
            if report.status != "published":
                not_published.append(report.title)
            elif not report.is_confirmed:
                not_confirmed.append(report.title)
            elif report.has_draft:
                not_confirmed.append(f"{report.title} (has changes)")
            continue
        note = session.get(Note, artifact_id)
        if note is not None:
            if note.status != "published":
                not_published.append(note.title)
            elif not note.is_confirmed:
                not_confirmed.append(note.title)
            elif note.has_draft:
                not_confirmed.append(f"{note.title} (has changes)")
            continue
        visual = session.get(Visual, artifact_id)
        if visual is not None:
            if visual.status != "published":
                not_published.append(visual.title)
            elif not visual.is_confirmed:
                not_confirmed.append(visual.title)
            elif visual.has_draft:
                not_confirmed.append(f"{visual.title} (has changes)")
            continue
        not_published.append(artifact_id)

    errors = []
    if not_published:
        errors.append(f"Not published: {', '.join(not_published)}")
    if not_confirmed:
        errors.append(f"Not confirmed: {', '.join(not_confirmed)}")
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish pack — {'; '.join(errors)}"
        )

    pack = session.get(Pack, pack_id)
    if not pack:
        pack = Pack(id=pack_id, created_at=now)

    # Archive current published version
    if pack.status == "published":
        version = PackVersion(
            pack_id      = pack_id,
            published_at = pack.published_at or now,
            name         = pack.name,
            statements   = pack.statements,
        )
        session.add(version)

    pack.name         = payload.name
    pack.description  = payload.description
    pack.status       = "published"
    pack.has_draft    = False
    pack.updated_at   = now
    pack.published_at = now
    pack.set_statements(payload.statements)
    pack.set_layout(payload.layout)

    session.add(pack)
    session.add(AuditLog(
        action       = "publish",
        target_type  = "pack",
        target_id    = pack_id,
        target_title = pack.name,
        timestamp    = now,
    ))
    session.commit()
    return {"status": "published", "id": pack_id}


# ─── Delete pack ──────────────────────────────────────────────────────────────

@router.delete("/{pack_id}")
async def delete_pack(pack_id: str, session: Session = Depends(get_session)):
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")

    session.add(AuditLog(
        action       = "delete",
        target_type  = "pack",
        target_id    = pack_id,
        target_title = pack.name,
    ))
    session.delete(pack)
    session.commit()
    return {"status": "deleted", "id": pack_id}


# ─── Pack history ─────────────────────────────────────────────────────────────

@router.get("/{pack_id}/history")
async def get_pack_history(pack_id: str, session: Session = Depends(get_session)):
    versions = session.exec(
        select(PackVersion)
        .where(PackVersion.pack_id == pack_id)
        .order_by(PackVersion.published_at.desc())
    ).all()
    return {
        "versions": [
            {
                "id":          v.id,
                "name":        v.name,
                "publishedAt": v.published_at.isoformat(),
                "publishedBy": v.published_by,
                "statements":  json.loads(v.statements),
            }
            for v in versions
        ]
    }


# ─── Available artifacts for pack composer ────────────────────────────────────

@router.get("/picker/notes")
async def picker_notes(session: Session = Depends(get_session)):
    """Return all published notes available to add to a pack."""
    notes = session.exec(
        select(Note)
        .where(Note.status == "published")
        .where(Note.is_confirmed == True)
        .where(Note.has_draft == False)
        .order_by(Note.title)
    ).all()
    return {
        "notes": [
            {
                "id":          n.id,
                "title":       n.title,
                "isConfirmed": n.is_confirmed,
                "confirmedAt": n.confirmed_at.isoformat() if n.confirmed_at else None,
            }
            for n in notes
        ]
    }


@router.get("/picker/visuals")
async def picker_visuals(session: Session = Depends(get_session)):
    """Return all published visuals available to add to a pack."""
    visuals = session.exec(
        select(Visual)
        .where(Visual.status == "published")
        .order_by(Visual.title)
    ).all()
    return {
        "visuals": [
            {
                "id":          v.id,
                "title":       v.title,
                "visualType":  v.visual_type,
                "isConfirmed": v.is_confirmed,
                "confirmedAt": v.confirmed_at.isoformat() if v.confirmed_at else None,
            }
            for v in visuals
        ]
    }


@router.get("/picker/reports")
async def picker_reports(session: Session = Depends(get_session)):
    """Return all published reports available to add to a pack."""
    reports = session.exec(
        select(Report)
        .where(Report.status == "published")
        .where(Report.is_confirmed == True)
        .where(Report.has_draft == False)
        .order_by(Report.title)
    ).all()
    return {
        "reports": [
            {
                "id":          r.id,
                "title":       r.title,
                "type":        r.type,
                "hasDraft":    r.has_draft,
                "isConfirmed": r.is_confirmed,
                "confirmedAt": r.confirmed_at.isoformat() if r.confirmed_at else None,
            }
            for r in reports
        ]
    }


# ─── Move to folder ────────────────────────────────────────────────────────────

class FolderPayload(BaseModel):
    folderId: Optional[str]

@router.post("/{pack_id}/folder")
async def move_pack_to_folder(
    pack_id: str,
    payload: FolderPayload,
    session: Session = Depends(get_session),
):
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")
    pack.folder_id = payload.folderId
    session.add(pack)
    session.commit()
    return {"status": "ok"}
