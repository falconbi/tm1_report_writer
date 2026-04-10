import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from db.database import get_session
from db.models import Folder

router = APIRouter(prefix="/api/folders", tags=["Folders"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── List by type ─────────────────────────────────────────────────────────────

class FolderListItem(BaseModel):
    id: str
    name: str
    artifactType: str
    parentId: str | None
    createdAt: str


@router.get("/list/{artifact_type}")
async def list_folders(artifact_type: str, session: Session = Depends(get_session)):
    folders = session.exec(select(Folder).where(Folder.artifact_type == artifact_type).order_by(Folder.name)).all()
    return {
        "folders": [
            {
                "id": f.id,
                "name": f.name,
                "artifactType": f.artifact_type,
                "parentId": f.parent_id,
                "createdAt": f.created_at.isoformat(),
            }
            for f in folders
        ]
    }


# ─── Create ──────────────────────────────────────────────────────────────────

class CreateFolderPayload(BaseModel):
    artifactType: str
    name: str = "New Folder"
    parentId: str | None = None

@router.post("/")
async def create_folder(payload: CreateFolderPayload, session: Session = Depends(get_session)):
    now = _now()
    folder_id = str(uuid.uuid4())
    folder = Folder(
        id=folder_id,
        name=payload.name,
        artifact_type=payload.artifactType,
        parent_id=payload.parentId,
        created_at=now,
    )
    session.add(folder)
    session.commit()
    return {"id": folder_id, "name": payload.name, "artifactType": payload.artifactType, "parentId": payload.parentId}


# ─── Move folder to parent ────────────────────────────────────────────────────

class MoveFolderPayload(BaseModel):
    parentId: str | None = None

@router.post("/{folder_id}/move")
async def move_folder(folder_id: str, payload: MoveFolderPayload, session: Session = Depends(get_session)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")
    
    if payload.parentId:
        parent = session.get(Folder, payload.parentId)
        if not parent:
            raise HTTPException(status_code=404, detail=f"Parent folder '{payload.parentId}' not found")
        
        depth = 1
        current = parent
        while current.parent_id:
            depth += 1
            current = session.get(Folder, current.parent_id)
            if not current or depth > 3:
                raise HTTPException(status_code=400, detail="Maximum folder depth is 3")
        
        depth += 1
        if depth > 3:
            raise HTTPException(status_code=400, detail="Maximum folder depth is 3")
    
    folder.parent_id = payload.parentId
    session.add(folder)
    session.commit()
    return {"id": folder_id, "parentId": payload.parentId}


# ─── Rename ──────────────────────────────────────────────────────────────────

@router.put("/{folder_id}")
async def rename_folder(folder_id: str, name: str, session: Session = Depends(get_session)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")
    folder.name = name
    session.add(folder)
    session.commit()
    return {"id": folder_id, "name": name}


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/{folder_id}")
async def delete_folder(folder_id: str, session: Session = Depends(get_session)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")
    session.delete(folder)
    session.commit()
    return {"status": "deleted", "id": folder_id}
