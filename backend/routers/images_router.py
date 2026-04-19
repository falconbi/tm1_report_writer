import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select

from db.database import get_session, IMAGES_DIR
from db.models import Image

try:
    from PIL import Image as PILImage

    HAS_PIL = True
except ImportError:
    HAS_PIL = False

router = APIRouter(prefix="/api/images", tags=["images"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
MAX_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


# ─── List ─────────────────────────────────────────────────────────────────────


@router.get("/list")
def list_images(session: Session = Depends(get_session)):
    images = session.exec(select(Image).order_by(Image.uploaded_at.desc())).all()
    return {
        "images": [
            {
                "id": img.id,
                "name": img.name,
                "filename": img.filename,
                "mimeType": img.mime_type,
                "sizeBytes": img.size_bytes,
                "width": img.width,
                "height": img.height,
                "description": img.description or "",
                "altText": img.alt_text or "",
                "tags": img.tags or "",
                "uploadedBy": img.uploaded_by,
                "folderId": img.folder_id,
                "uploadedAt": img.uploaded_at.isoformat(),
                "url": f"/images/{img.filename}",
            }
            for img in images
        ]
    }


# ─── Upload ───────────────────────────────────────────────────────────────────


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    name: str = Form(""),
    description: str = Form(""),
    alt_text: str = Form(""),
    tags: str = Form(""),
    session: Session = Depends(get_session),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    # Read and size-check
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(
            400, f"File too large (max {MAX_SIZE_BYTES // 1024 // 1024} MB)"
        )

    # Generate a unique filename preserving extension
    suffix = Path(file.filename or "image").suffix or ".jpg"
    image_id = str(uuid.uuid4())
    stored_filename = f"{image_id}{suffix}"

    # Write to disk
    dest = IMAGES_DIR / stored_filename
    dest.write_bytes(data)

    # Extract dimensions if possible
    width = None
    height = None
    if HAS_PIL and file.content_type != "image/svg+xml":
        try:
            with PILImage.open(dest) as img:
                width, height = img.size
        except Exception:
            pass

    # Persist to DB
    label = name.strip() or Path(file.filename or "").stem or "Image"
    img = Image(
        id=image_id,
        name=label,
        filename=stored_filename,
        mime_type=file.content_type,
        size_bytes=len(data),
        width=width,
        height=height,
        description=description.strip(),
        alt_text=alt_text.strip(),
        tags=tags.strip(),
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
        "width": img.width,
        "height": img.height,
        "description": img.description or "",
        "altText": img.alt_text or "",
        "tags": img.tags or "",
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


# ─── Update metadata ─────────────────────────────────────────────────────────────


class ImageMetadata(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    alt_text: Optional[str] = None
    tags: Optional[str] = None
    uploaded_by: Optional[str] = None


@router.patch("/{image_id}")
def update_image_metadata(
    image_id: str,
    body: ImageMetadata,
    session: Session = Depends(get_session),
):
    img = session.get(Image, image_id)
    if not img:
        raise HTTPException(404, "Image not found")

    if body.name is not None:
        img.name = body.name.strip() or img.name
    if body.description is not None:
        img.description = body.description.strip()
    if body.alt_text is not None:
        img.alt_text = body.alt_text.strip()
    if body.tags is not None:
        img.tags = body.tags.strip()
    if body.uploaded_by is not None:
        img.uploaded_by = body.uploaded_by

    session.add(img)
    session.commit()
    session.refresh(img)

    return {
        "id": img.id,
        "name": img.name,
        "filename": img.filename,
        "mimeType": img.mime_type,
        "sizeBytes": img.size_bytes,
        "width": img.width,
        "height": img.height,
        "description": img.description or "",
        "altText": img.alt_text or "",
        "tags": img.tags or "",
        "uploadedBy": img.uploaded_by,
        "folderId": img.folder_id,
        "uploadedAt": img.uploaded_at.isoformat(),
        "url": f"/images/{img.filename}",
    }


# ─── Move to folder ────────────────────────────────────────────────────────────


class FolderPayload(BaseModel):
    folderId: Optional[str]


@router.post("/{image_id}/folder")
def move_image_to_folder(
    image_id: str,
    payload: FolderPayload,
    session: Session = Depends(get_session),
):
    img = session.get(Image, image_id)
    if not img:
        raise HTTPException(404, "Image not found")
    img.folder_id = payload.folderId
    session.add(img)
    session.commit()
    return {"status": "ok"}
