import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select

from db.database import get_session, IMAGES_DIR
from db.models import Image

router = APIRouter(prefix="/api/images", tags=["images"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
MAX_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/list")
def list_images(session: Session = Depends(get_session)):
    images = session.exec(select(Image).order_by(Image.uploaded_at.desc())).all()
    return {"images": [
        {
            "id": img.id,
            "name": img.name,
            "filename": img.filename,
            "mimeType": img.mime_type,
            "sizeBytes": img.size_bytes,
            "uploadedAt": img.uploaded_at.isoformat(),
            "url": f"/images/{img.filename}",
        }
        for img in images
    ]}


# ─── Upload ───────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    name: str = Form(""),
    session: Session = Depends(get_session),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    # Read and size-check
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(400, f"File too large (max {MAX_SIZE_BYTES // 1024 // 1024} MB)")

    # Generate a unique filename preserving extension
    suffix = Path(file.filename or "image").suffix or ".jpg"
    image_id = str(uuid.uuid4())
    stored_filename = f"{image_id}{suffix}"

    # Write to disk
    dest = IMAGES_DIR / stored_filename
    dest.write_bytes(data)

    # Persist to DB
    label = name.strip() or Path(file.filename or "").stem or "Image"
    img = Image(
        id=image_id,
        name=label,
        filename=stored_filename,
        mime_type=file.content_type,
        size_bytes=len(data),
    )
    session.add(img)
    session.commit()
    session.refresh(img)

    return {
        "id": img.id,
        "name": img.name,
        "filename": img.filename,
        "mimeType": img.mime_type,
        "sizeBytes": img.size_bytes,
        "uploadedAt": img.uploaded_at.isoformat(),
        "url": f"/images/{img.filename}",
    }


# ─── Rename ───────────────────────────────────────────────────────────────────

@router.patch("/{image_id}/rename")
def rename_image(image_id: str, body: dict, session: Session = Depends(get_session)):
    img = session.get(Image, image_id)
    if not img:
        raise HTTPException(404, "Image not found")
    new_name = (body.get("name") or "").strip()
    if not new_name:
        raise HTTPException(400, "Name is required")
    img.name = new_name
    session.add(img)
    session.commit()
    return {"ok": True}


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/{image_id}")
def delete_image(image_id: str, session: Session = Depends(get_session)):
    img = session.get(Image, image_id)
    if not img:
        raise HTTPException(404, "Image not found")

    # Remove from disk (ignore if already gone)
    file_path = IMAGES_DIR / img.filename
    if file_path.exists():
        file_path.unlink()

    session.delete(img)
    session.commit()
    return {"ok": True}
