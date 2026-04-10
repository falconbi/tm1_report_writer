import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Optional
from sqlmodel import Session, select

from db.database import get_session
from db.models import Visual, AuditLog

router = APIRouter(prefix="/api/visuals", tags=["Visuals"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/list")
async def list_visuals(session: Session = Depends(get_session)):
    visuals = session.exec(select(Visual).order_by(Visual.updated_at.desc())).all()
    return {
        "visuals": [
            {
                "id":            v.id,
                "title":         v.title,
                "visualType":    v.visual_type,
                "status":        v.status,
                "hasDraft":      v.has_draft,
                "everPublished": v.published_at is not None,
                "isConfirmed":   v.is_confirmed,
                "confirmedAt":   v.confirmed_at.isoformat() if v.confirmed_at else None,
                "confirmedBy":   v.confirmed_by,
                "folderId":      v.folder_id,
                "updatedAt":     v.updated_at.isoformat(),
                "publishedAt":   v.published_at.isoformat() if v.published_at else None,
            }
            for v in visuals
        ]
    }


# ─── Picker (published visuals for pack composer) ─────────────────────────────

@router.get("/picker")
async def picker_visuals(session: Session = Depends(get_session)):
    visuals = session.exec(
        select(Visual).where(Visual.status == "published").order_by(Visual.title)
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


# ─── Get ──────────────────────────────────────────────────────────────────────

@router.get("/{visual_id}")
async def get_visual(
    visual_id: str,
    published: bool = False,
    session: Session = Depends(get_session),
):
    v = session.get(Visual, visual_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"Visual '{visual_id}' not found")
    defn = v.get_definition()
    if published and v.published_definition and v.published_definition != "{}":
        import json
        defn = json.loads(v.published_definition)
    return {
        "id":          v.id,
        "title":       v.title,
        "visualType":  v.visual_type,
        "status":      v.status,
        "isConfirmed": v.is_confirmed,
        "definition":  defn,
    }


# ─── Save draft ───────────────────────────────────────────────────────────────

class VisualPayload(BaseModel):
    title: str = "Untitled Visual"
    visualType: str = "kpi"
    definition: Any = {}

@router.post("/{visual_id}/draft")
async def save_draft(
    visual_id: str,
    payload: VisualPayload,
    session: Session = Depends(get_session),
):
    now = _now()
    v = session.get(Visual, visual_id)
    if v:
        v.title        = payload.title
        v.visual_type  = payload.visualType
        v.has_draft    = True
        v.is_confirmed = False   # content changed — confirmation stale
        if v.status != "published":
            v.status = "draft"
        v.updated_at = now
        v.set_definition(payload.definition if isinstance(payload.definition, dict) else {})
    else:
        v = Visual(
            id          = visual_id,
            title       = payload.title,
            visual_type = payload.visualType,
            status      = "draft",
            has_draft   = True,
            created_at  = now,
            updated_at  = now,
        )
        v.set_definition(payload.definition if isinstance(payload.definition, dict) else {})

    session.add(v)
    session.add(AuditLog(
        action       = "save_draft",
        target_type  = "visual",
        target_id    = visual_id,
        target_title = v.title,
        timestamp    = now,
    ))
    session.commit()
    return {"status": "saved", "id": visual_id}


# ─── Create new ───────────────────────────────────────────────────────────────

@router.post("/")
async def create_visual(session: Session = Depends(get_session)):
    now = _now()
    visual_id = str(uuid.uuid4())
    v = Visual(
        id          = visual_id,
        title       = "Untitled Visual",
        visual_type = "kpi",
        status      = "draft",
        has_draft   = True,
        created_at  = now,
        updated_at  = now,
    )
    v.set_definition({})
    session.add(v)
    session.add(AuditLog(
        action       = "create",
        target_type  = "visual",
        target_id    = visual_id,
        target_title = "Untitled Visual",
        timestamp    = now,
    ))
    session.commit()
    return {"id": visual_id, "title": "Untitled Visual", "visualType": "kpi", "status": "draft", "definition": {}}


# ─── Publish ──────────────────────────────────────────────────────────────────

@router.post("/{visual_id}/publish")
async def publish_visual(
    visual_id: str,
    payload: VisualPayload,
    session: Session = Depends(get_session),
):
    now = _now()
    v = session.get(Visual, visual_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"Visual '{visual_id}' not found")

    defn = payload.definition if isinstance(payload.definition, dict) else {}
    v.title               = payload.title
    v.visual_type         = payload.visualType
    v.has_draft           = False
    v.status              = "published"
    v.updated_at          = now
    v.published_at        = now
    v.published_definition = __import__('json').dumps(defn)
    v.set_definition(defn)

    session.add(v)
    session.add(AuditLog(
        action       = "publish",
        target_type  = "visual",
        target_id    = visual_id,
        target_title = v.title,
        timestamp    = now,
    ))
    session.commit()
    return {"status": "published", "id": visual_id}


# ─── Confirm ─────────────────────────────────────────────────────────────────

@router.post("/{visual_id}/confirm")
async def confirm_visual(visual_id: str, session: Session = Depends(get_session)):
    now = _now()
    v = session.get(Visual, visual_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"Visual '{visual_id}' not found")

    v.is_confirmed = True
    v.confirmed_at = now
    v.confirmed_by = "builder"

    session.add(v)
    session.add(AuditLog(
        action       = "confirm",
        target_type  = "visual",
        target_id    = visual_id,
        target_title = v.title,
        timestamp    = now,
    ))
    session.commit()
    return {
        "status":      "confirmed",
        "confirmedAt": now.isoformat(),
        "confirmedBy": "builder",
    }


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/{visual_id}")
async def delete_visual(visual_id: str, session: Session = Depends(get_session)):
    v = session.get(Visual, visual_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"Visual '{visual_id}' not found")

    session.add(AuditLog(
        action       = "delete",
        target_type  = "visual",
        target_id    = visual_id,
        target_title = v.title,
    ))
    session.delete(v)
    session.commit()
    return {"status": "deleted", "id": visual_id}


# ─── Move to folder ────────────────────────────────────────────────────────────

class FolderPayload(BaseModel):
    folderId: Optional[str]

@router.post("/{visual_id}/folder")
async def move_visual_to_folder(
    visual_id: str,
    payload: FolderPayload,
    session: Session = Depends(get_session),
):
    v = session.get(Visual, visual_id)
    if not v:
        raise HTTPException(status_code=404, detail=f"Visual '{visual_id}' not found")
    v.folder_id = payload.folderId
    session.add(v)
    session.commit()
    return {"status": "ok"}
