import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from db.database import get_session
from db.models import Note, AuditLog

router = APIRouter(prefix="/api/notes", tags=["Notes"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── List ─────────────────────────────────────────────────────────────────────


@router.get("/list")
async def list_notes(session: Session = Depends(get_session)):
    notes = session.exec(select(Note).order_by(Note.updated_at.desc())).all()
    return {
        "notes": [
            {
                "id": n.id,
                "title": n.title,
                "status": n.status,
                "hasDraft": n.has_draft,
                "everPublished": n.published_at is not None,
                "isConfirmed": n.is_confirmed,
                "confirmedAt": n.confirmed_at.isoformat() if n.confirmed_at else None,
                "confirmedBy": n.confirmed_by,
                "readyToConfirm": n.ready_to_confirm,
                "folderId": n.folder_id,
                "owner": n.owner,
                "updatedAt": n.updated_at.isoformat(),
                "publishedAt": n.published_at.isoformat() if n.published_at else None,
            }
            for n in notes
        ]
    }


# ─── Get ──────────────────────────────────────────────────────────────────────


@router.get("/{note_id}")
async def get_note(
    note_id: str,
    published: bool = False,
    session: Session = Depends(get_session),
):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found")
    if published and note.published_content:
        return {
            "id": note.id,
            "title": note.title,
            "content": note.published_content,
            "status": note.status,
            "isConfirmed": note.is_confirmed,
            "readyToConfirm": note.ready_to_confirm,
        }
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "status": note.status,
        "isConfirmed": note.is_confirmed,
        "readyToConfirm": note.ready_to_confirm,
        "hasDraft": note.has_draft,
    }


# ─── Save draft ───────────────────────────────────────────────────────────────


class NotePayload(BaseModel):
    title: str = "Untitled Note"
    content: str = ""


@router.post("/{note_id}/draft")
async def save_draft(
    note_id: str,
    payload: NotePayload,
    session: Session = Depends(get_session),
):
    now = _now()
    note = session.get(Note, note_id)
    if note:
        note.title = payload.title
        note.content = payload.content
        note.has_draft = True
        # Only clear ready_to_confirm if not confirmed
        if not note.is_confirmed:
            note.ready_to_confirm = False
        if note.status != "published":
            note.status = "draft"
        note.updated_at = now
    else:
        note = Note(
            id=note_id,
            title=payload.title,
            content=payload.content,
            status="draft",
            has_draft=True,
            created_at=now,
            updated_at=now,
        )

    session.add(note)
    session.add(
        AuditLog(
            action="save_draft",
            target_type="note",
            target_id=note_id,
            target_title=note.title,
            timestamp=now,
        )
    )
    session.commit()
    return {"status": "saved", "id": note_id}


# ─── Create new (generates ID) ────────────────────────────────────────────────


@router.post("/")
async def create_note(session: Session = Depends(get_session)):
    now = _now()
    note_id = str(uuid.uuid4())
    note = Note(
        id=note_id,
        title="Untitled Note",
        content="",
        status="draft",
        has_draft=False,
        created_at=now,
        updated_at=now,
    )
    session.add(note)
    session.add(
        AuditLog(
            action="create",
            target_type="note",
            target_id=note_id,
            target_title="Untitled Note",
            timestamp=now,
        )
    )
    session.commit()
    return {"id": note_id, "title": "Untitled Note", "content": "", "status": "draft"}


# ─── Publish ──────────────────────────────────────────────────────────────────


@router.post("/{note_id}/publish")
async def publish_note(
    note_id: str,
    payload: NotePayload,
    session: Session = Depends(get_session),
):
    now = _now()
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found")

    note.title = payload.title
    note.content = payload.content
    note.published_content = payload.content
    note.status = "published"
    note.has_draft = False
    note.ready_to_confirm = True
    note.updated_at = now
    note.published_at = now

    session.add(note)
    session.add(
        AuditLog(
            action="publish",
            target_type="note",
            target_id=note_id,
            target_title=note.title,
            timestamp=now,
        )
    )
    session.commit()
    return {"status": "published", "id": note_id}


# ─── Confirm ─────────────────────────────────────────────────────────────────


@router.post("/{note_id}/confirm")
async def confirm_note(note_id: str, session: Session = Depends(get_session)):
    now = _now()
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found")

    if not note.ready_to_confirm and not note.is_confirmed:
        raise HTTPException(
            status_code=400, detail="Note must be submitted for confirmation first"
        )

    note.is_confirmed = True
    note.ready_to_confirm = False
    note.confirmed_at = now
    note.confirmed_by = "builder"  # replaced by real user once auth is in

    session.add(note)
    session.add(
        AuditLog(
            action="confirm_commentary",
            target_type="note",
            target_id=note_id,
            target_title=note.title,
            timestamp=now,
        )
    )
    session.commit()
    return {
        "status": "confirmed",
        "confirmedAt": now.isoformat(),
        "confirmedBy": "builder",
    }


# ─── Submit for Confirm ────────────────────────────────────────────────────────


@router.post("/{note_id}/submit-for-confirm")
async def submit_for_confirm(note_id: str, session: Session = Depends(get_session)):
    now = _now()
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found")

    if not note.content or note.content.strip() == "":
        raise HTTPException(
            status_code=400,
            detail="Note must have content before submitting for confirm",
        )

    note.ready_to_confirm = True
    note.updated_at = now

    session.add(note)
    session.add(
        AuditLog(
            action="submit_for_confirm",
            target_type="note",
            target_id=note_id,
            target_title=note.title,
            timestamp=now,
        )
    )
    session.commit()
    return {"status": "ready-to-confirm", "id": note_id}


# ─── Release (unlock confirmed note) ───────────────────────────────────────────


@router.post("/{note_id}/release")
async def release_note(note_id: str, session: Session = Depends(get_session)):
    now = _now()
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found")

    if not note.is_confirmed:
        raise HTTPException(
            status_code=400, detail="Only confirmed notes can be released"
        )

    note.is_confirmed = False
    note.ready_to_confirm = False
    note.has_draft = True
    note.updated_at = now

    session.add(note)
    session.add(
        AuditLog(
            action="release",
            target_type="note",
            target_id=note_id,
            target_title=note.title,
            timestamp=now,
        )
    )
    session.commit()
    return {"status": "released", "id": note_id}


# ─── Delete ───────────────────────────────────────────────────────────────────


@router.delete("/{note_id}")
async def delete_note(note_id: str, session: Session = Depends(get_session)):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found")

    session.add(
        AuditLog(
            action="delete",
            target_type="note",
            target_id=note_id,
            target_title=note.title,
        )
    )
    session.delete(note)
    session.commit()
    return {"status": "deleted", "id": note_id}


# ─── Move to folder ────────────────────────────────────────────────────────────


class FolderPayload(BaseModel):
    folderId: Optional[str]


@router.post("/{note_id}/folder")
async def move_note_to_folder(
    note_id: str,
    payload: FolderPayload,
    session: Session = Depends(get_session),
):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note '{note_id}' not found")
    note.folder_id = payload.folderId
    session.add(note)
    session.commit()
    return {"status": "ok"}
