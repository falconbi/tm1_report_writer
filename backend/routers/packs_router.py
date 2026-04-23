import json
import os
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from db.database import get_session
from db.models import Pack, PackVersion, Report, Visual, AuditLog, PackComment

router = APIRouter(prefix="/api/packs", tags=["Packs"])


# ─── List packs ───────────────────────────────────────────────────────────────


@router.get("/list")
async def list_packs(session: Session = Depends(get_session)):
    packs = session.exec(select(Pack).order_by(Pack.updated_at.desc())).all()
    return {
        "packs": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "status": p.status,
                "hasDraft": p.has_draft,
                "locked": p.locked,
                "lockedAt": p.locked_at.isoformat() if p.locked_at else None,
                "lockedBy": p.locked_by,
                "rolledFromPackId": p.rolled_from_pack_id,
                "folderId": p.folder_id,
                "owner": p.owner,
                "statements": p.get_statements(),
                "layout": p.get_layout(),
                "defaults": json.loads(p.defaults or "{}"),
                "updatedAt": p.updated_at.isoformat(),
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
        "id": pack.id,
        "name": pack.name,
        "description": pack.description,
        "status": pack.status,
        "hasDraft": pack.has_draft,
        "locked": pack.locked,
        "lockedAt": pack.locked_at.isoformat() if pack.locked_at else None,
        "lockedBy": pack.locked_by,
        "rolledFromPackId": pack.rolled_from_pack_id,
        "owner": pack.owner,
        "statements": pack.get_statements(),
        "layout": pack.get_layout(),
        "defaults": json.loads(pack.defaults or "{}"),
        "updatedAt": pack.updated_at.isoformat(),
        "publishedAt": pack.published_at.isoformat() if pack.published_at else None,
    }


# ─── Save pack (draft) ────────────────────────────────────────────────────────


class PackPayload(BaseModel):
    name: str
    description: str = ""
    statements: list[str] = []
    layout: list[Any] = []
    defaults: dict[str, Any] = {}


@router.post("/{pack_id}/draft")
async def save_pack_draft(
    pack_id: str,
    payload: PackPayload,
    session: Session = Depends(get_session),
):
    now = datetime.now(timezone.utc)
    pack = session.get(Pack, pack_id)

    if pack:
        pack.name = payload.name
        pack.description = payload.description
        pack.updated_at = now
        pack.has_draft = True
        # Only flip to draft if never published
        if pack.status != "published":
            pack.status = "draft"
        pack.set_statements(payload.statements)
        pack.set_layout(payload.layout)
        pack.defaults = json.dumps(payload.defaults)
    else:
        pack = Pack(
            id=pack_id,
            name=payload.name,
            description=payload.description,
            status="draft",
            has_draft=True,
            created_at=now,
            updated_at=now,
        )
        pack.set_statements(payload.statements)
        pack.set_layout(payload.layout)
        pack.defaults = json.dumps(payload.defaults)

    session.add(pack)
    session.add(
        AuditLog(
            action="save_draft",
            target_type="pack",
            target_id=pack_id,
            target_title=pack.name,
            timestamp=now,
        )
    )
    # Log text slots that have content
    layout = pack.get_layout()
    for page_idx, page in enumerate(layout):
        for section in page.get("sections", []):
            for slot_idx, slot in enumerate(section.get("slots", [])):
                text = slot.get("textContent", "")
                if slot.get("artifactType") == "text" and text.strip():
                    slot_label = (
                        slot.get("noteLabel")
                        or slot.get("description")
                        or text.strip()[:30]
                        or f"text slot {slot_idx + 1}"
                    )
                    session.add(
                        AuditLog(
                            action="save_draft",
                            target_type="text_slot",
                            target_id=f"{pack.id}-p{page_idx + 1}-s{slot_idx + 1}",
                            target_title=f"{pack.name} - {slot_label} (page {page_idx + 1})",
                            timestamp=now,
                        )
                    )
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

    # Validate all artifacts are published with no pending changes
    not_published = []
    has_changes = []
    for artifact_id in payload.statements:
        report = session.get(Report, artifact_id)
        if report is not None:
            if report.status != "published":
                not_published.append(report.title)
            elif report.has_draft:
                has_changes.append(f"{report.title} (has changes)")
            continue
        visual = session.get(Visual, artifact_id)
        if visual is not None:
            if visual.status != "published":
                not_published.append(visual.title)
            elif visual.has_draft:
                has_changes.append(f"{visual.title} (has changes)")
            continue
        not_published.append(artifact_id)

    errors = []
    if not_published:
        errors.append(f"Not published: {', '.join(not_published)}")
    if has_changes:
        errors.append(f"Has unpublished changes: {', '.join(has_changes)}")
    if errors:
        raise HTTPException(
            status_code=400, detail=f"Cannot publish pack — {'; '.join(errors)}"
        )

    pack = session.get(Pack, pack_id)
    if not pack:
        pack = Pack(id=pack_id, created_at=now)

    if pack.locked:
        raise HTTPException(status_code=400, detail="Pack is locked and cannot be modified")

    # Archive current published version
    if pack.status == "published":
        version = PackVersion(
            pack_id=pack_id,
            published_at=pack.published_at or now,
            name=pack.name,
            statements=pack.statements,
            layout=pack.layout,
        )
        session.add(version)

    pack.name = payload.name
    pack.description = payload.description
    pack.status = "published"
    pack.has_draft = False
    pack.updated_at = now
    pack.published_at = now
    pack.set_statements(payload.statements)
    pack.set_layout(payload.layout)
    pack.defaults = json.dumps(payload.defaults)

    session.add(pack)
    session.add(
        AuditLog(
            action="publish",
            target_type="pack",
            target_id=pack_id,
            target_title=pack.name,
            timestamp=now,
        )
    )
    session.commit()
    return {"status": "published", "id": pack_id}


# ─── Publish saved (from builder, no payload) ────────────────────────────────


@router.post("/{pack_id}/publish-saved")
async def publish_pack_saved(pack_id: str, session: Session = Depends(get_session)):
    """Publish the currently saved draft without sending a payload (used from AppBar)."""
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    if pack.locked:
        raise HTTPException(status_code=400, detail="Pack is locked and cannot be modified")

    statements = pack.get_statements()
    layout = pack.get_layout()

    # Validate no open priority page notes
    has_open_notes = any(
        page.get("pageNotePriority") and not page.get("pageNoteResolved")
        for page in layout
    )
    if has_open_notes:
        raise HTTPException(
            status_code=400,
            detail="Cannot publish — there are open priority page notes that must be resolved first",
        )

    # Validate all artifacts are published with no pending changes
    not_published = []
    has_changes = []
    for artifact_id in statements:
        report = session.get(Report, artifact_id)
        if report is not None:
            if report.status != "published":
                not_published.append(report.title)
            elif report.has_draft:
                has_changes.append(f"{report.title} (has changes)")
            continue
        visual = session.get(Visual, artifact_id)
        if visual is not None:
            if visual.status != "published":
                not_published.append(visual.title)
            elif visual.has_draft:
                has_changes.append(f"{visual.title} (has changes)")
            continue
        not_published.append(artifact_id)

    errors = []
    if not_published:
        errors.append(f"Not published: {', '.join(not_published)}")
    if has_changes:
        errors.append(f"Has unpublished changes: {', '.join(has_changes)}")
    if errors:
        raise HTTPException(status_code=400, detail=f"Cannot publish pack — {'; '.join(errors)}")

    now = datetime.now(timezone.utc)

    if pack.status == "published":
        version = PackVersion(
            pack_id=pack_id,
            published_at=pack.published_at or now,
            name=pack.name,
            statements=pack.statements,
            layout=pack.layout,
        )
        session.add(version)

    pack.status = "published"
    pack.has_draft = False
    pack.updated_at = now
    pack.published_at = now

    session.add(pack)
    session.add(
        AuditLog(
            action="publish",
            target_type="pack",
            target_id=pack_id,
            target_title=pack.name,
            timestamp=now,
        )
    )
    session.commit()
    return {"status": "published", "id": pack_id, "publishedAt": now.isoformat()}


# ─── Lock pack ────────────────────────────────────────────────────────────────


@router.post("/{pack_id}/lock")
async def lock_pack(pack_id: str, session: Session = Depends(get_session)):
    """Permanently lock a published pack. Immutable after this point."""
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    if pack.status != "published":
        raise HTTPException(status_code=400, detail="Pack must be published before locking")
    if pack.locked:
        raise HTTPException(status_code=400, detail="Pack is already locked")

    now = datetime.now(timezone.utc)
    pack.locked = True
    pack.locked_at = now
    pack.locked_by = "system"

    # Archive a frozen snapshot with full layout
    version = PackVersion(
        pack_id=pack_id,
        published_at=now,
        name=pack.name,
        statements=pack.statements,
        layout=pack.layout,
    )
    session.add(version)
    session.add(pack)
    session.add(
        AuditLog(
            action="lock",
            target_type="pack",
            target_id=pack_id,
            target_title=pack.name,
            timestamp=now,
        )
    )
    session.commit()
    return {"status": "locked", "id": pack_id, "lockedAt": now.isoformat()}


# ─── Roll Forward ─────────────────────────────────────────────────────────────


class RollForwardPayload(BaseModel):
    name: str


@router.post("/{pack_id}/roll-forward")
async def roll_forward_pack(
    pack_id: str,
    payload: RollForwardPayload,
    session: Session = Depends(get_session),
):
    """Create a new draft pack from a locked pack snapshot."""
    source = session.get(Pack, pack_id)
    if not source or not source.locked:
        raise HTTPException(status_code=400, detail="Source pack must be locked before rolling forward")

    # Use latest version for the frozen snapshot
    latest_version = session.exec(
        select(PackVersion)
        .where(PackVersion.pack_id == pack_id)
        .order_by(PackVersion.published_at.desc())
    ).first()

    source_statements = (
        json.loads(latest_version.statements) if latest_version else source.get_statements()
    )
    source_layout_raw = (
        latest_version.layout
        if latest_version and latest_version.layout and latest_version.layout != "[]"
        else source.layout
    )
    source_layout = json.loads(source_layout_raw) if source_layout_raw else []

    # Clear page notes from all pages
    new_layout = [
        {k: v for k, v in page.items() if k not in ("pageNote", "pageNotePriority", "pageNoteResolved")}
        for page in source_layout
    ]

    # Check which artifacts still exist
    valid_statements = []
    missing_ids = []
    for artifact_id in source_statements:
        exists = (
            session.get(Report, artifact_id) is not None
            or session.get(Visual, artifact_id) is not None
        )
        if exists:
            valid_statements.append(artifact_id)
        else:
            missing_ids.append(artifact_id)

    now = datetime.now(timezone.utc)
    new_id = str(_uuid.uuid4())

    new_pack = Pack(
        id=new_id,
        name=payload.name,
        description=source.description,
        status="draft",
        has_draft=True,
        rolled_from_pack_id=pack_id,
        created_at=now,
        updated_at=now,
    )
    new_pack.set_statements(valid_statements)
    new_pack.set_layout(new_layout)

    session.add(new_pack)
    session.add(
        AuditLog(
            action="roll_forward",
            target_type="pack",
            target_id=new_id,
            target_title=payload.name,
            timestamp=now,
            detail=f"Rolled forward from '{source.name}' ({pack_id}). Missing artifacts: {len(missing_ids)}",
        )
    )
    session.commit()
    return {
        "id": new_id,
        "name": payload.name,
        "missingArtifacts": missing_ids,
        "missingCount": len(missing_ids),
    }


# ─── Delete pack ──────────────────────────────────────────────────────────────


@router.delete("/{pack_id}")
async def delete_pack(pack_id: str, session: Session = Depends(get_session)):
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")

    session.add(
        AuditLog(
            action="delete",
            target_type="pack",
            target_id=pack_id,
            target_title=pack.name,
        )
    )
    session.delete(pack)
    session.commit()
    return {"status": "deleted", "id": pack_id}


# ─── Rename pack ──────────────────────────────────────────────────────────────


@router.put("/{pack_id}/rename")
async def rename_pack(
    pack_id: str, name: str = Query(...), session: Session = Depends(get_session)
):
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")
    pack.name = name
    session.add(pack)
    session.commit()
    return {"status": "renamed", "id": pack_id, "name": name}


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
                "id": v.id,
                "name": v.name,
                "publishedAt": v.published_at.isoformat(),
                "publishedBy": v.published_by,
                "statements": json.loads(v.statements),
            }
            for v in versions
        ]
    }


# ─── Available artifacts for pack composer ────────────────────────────────────



@router.get("/picker/visuals")
async def picker_visuals(session: Session = Depends(get_session)):
    """Return all published visuals available to add to a pack."""
    visuals = session.exec(
        select(Visual).where(Visual.status == "published").order_by(Visual.title)
    ).all()
    return {
        "visuals": [
            {
                "id": v.id,
                "title": v.title,
                "visualType": v.visual_type,
                "hasDraft": v.has_draft,
                "lastDatasetAt": v.last_dataset_at.isoformat() if v.last_dataset_at else None,
                "publishedAt": v.published_at.isoformat() if v.published_at else None,
            }
            for v in visuals
        ]
    }


@router.get("/picker/reports")
async def picker_reports(session: Session = Depends(get_session)):
    """Return all published reports available to add to a pack."""
    reports = session.exec(
        select(Report).where(Report.status == "published").order_by(Report.title)
    ).all()
    return {
        "reports": [
            {
                "id": r.id,
                "title": r.title,
                "hasDraft": r.has_draft,
                "lastDatasetAt": r.last_dataset_at.isoformat() if r.last_dataset_at else None,
                "publishedAt": r.published_at.isoformat() if r.published_at else None,
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


# ─── Pack comments ────────────────────────────────────────────────────────────


def _now():
    return datetime.now(timezone.utc)


@router.get("/{pack_id}/comments")
async def list_comments(pack_id: str, session: Session = Depends(get_session)):
    comments = session.exec(
        select(PackComment)
        .where(PackComment.pack_id == pack_id)
        .order_by(PackComment.created_at)
    ).all()
    return {
        "comments": [
            {
                "id": c.id,
                "author": c.author,
                "body": c.body,
                "createdAt": c.created_at.isoformat(),
            }
            for c in comments
        ]
    }


class CommentPayload(BaseModel):
    author: str
    body: str


@router.post("/{pack_id}/comments")
async def add_comment(
    pack_id: str,
    payload: CommentPayload,
    session: Session = Depends(get_session),
):
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Comment body cannot be empty")
    comment = PackComment(
        pack_id=pack_id,
        author=payload.author.strip() or "Anonymous",
        body=payload.body.strip(),
        created_at=_now(),
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return {
        "id": comment.id,
        "author": comment.author,
        "body": comment.body,
        "createdAt": comment.created_at.isoformat(),
    }


@router.delete("/{pack_id}/comments/{comment_id}")
async def delete_comment(
    pack_id: str,
    comment_id: int,
    session: Session = Depends(get_session),
):
    comment = session.get(PackComment, comment_id)
    if not comment or comment.pack_id != pack_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    session.delete(comment)
    session.commit()
    return {"status": "deleted"}


# ─── PDF export ───────────────────────────────────────────────────────────────

@router.get("/{pack_id}/pdf")
async def export_pdf(pack_id: str, session: Session = Depends(get_session)):
    pack = session.get(Pack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise HTTPException(status_code=501, detail="Playwright not installed")

    app_url = os.getenv("APP_INTERNAL_URL", "http://localhost:5173")
    viewer_url = f"{app_url}/viewer/{pack_id}?pdf=1"
    safe_name = pack.name.replace(" ", "_").replace("/", "-")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto(viewer_url, wait_until="networkidle", timeout=60000)

        # Wait until all async slots have finished loading
        try:
            await page.wait_for_function("window.__pdfReady === true", timeout=30000)
        except Exception:
            pass  # Proceed anyway if timeout — content may still be usable

        await page.emulate_media(media="print")

        pdf_bytes = await page.pdf(
            format="A4",
            landscape=True,
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        await browser.close()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )
