import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any
from services.dataset_service import fetch_dataset

router = APIRouter(prefix="/api/reports", tags=["Reports"])

DRAFTS_DIR      = Path(__file__).parent.parent / "drafts"
DEFINITIONS_DIR = Path(__file__).parent.parent / "definitions"
HISTORY_DIR     = Path(__file__).parent.parent / "history"

for d in (DRAFTS_DIR, DEFINITIONS_DIR, HISTORY_DIR):
    d.mkdir(exist_ok=True)


# ─── Dataset ─────────────────────────────────────────────────────────────────

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
async def list_reports():
    """Return all drafts and published reports."""
    reports = []

    for f in sorted(DRAFTS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            reports.append({
                "id":     data.get("id", f.stem),
                "title":  data.get("title", "Untitled"),
                "status": "draft",
            })
        except Exception:
            pass

    for f in sorted(DEFINITIONS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            reports.append({
                "id":     data.get("id", f.stem),
                "title":  data.get("title", "Untitled"),
                "status": "published",
            })
        except Exception:
            pass

    return {"reports": reports}


# ─── Load definition ──────────────────────────────────────────────────────────

@router.get("/definitions/{report_id}")
async def get_definition(report_id: str):
    # Draft takes priority over published
    for directory in (DRAFTS_DIR, DEFINITIONS_DIR):
        path = directory / f"{report_id}.json"
        if path.exists():
            return json.loads(path.read_text())
    raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")


# ─── Save draft ───────────────────────────────────────────────────────────────

class DefinitionPayload(BaseModel):
    definition: dict[str, Any]

@router.post("/definitions/{report_id}/draft")
async def save_draft(report_id: str, payload: DefinitionPayload):
    path = DRAFTS_DIR / f"{report_id}.json"
    data = payload.definition
    data["id"] = report_id
    data["savedAt"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(data, indent=2))
    return {"status": "saved", "id": report_id}


# ─── Publish ──────────────────────────────────────────────────────────────────

@router.post("/definitions/{report_id}/publish")
async def publish_definition(report_id: str, payload: DefinitionPayload):
    published_path = DEFINITIONS_DIR / f"{report_id}.json"

    # Archive existing published version to history
    if published_path.exists():
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        history_dir = HISTORY_DIR / report_id
        history_dir.mkdir(exist_ok=True)
        shutil.copy(published_path, history_dir / f"{ts}.json")

    data = payload.definition
    data["id"] = report_id
    data["publishedAt"] = datetime.now(timezone.utc).isoformat()
    published_path.write_text(json.dumps(data, indent=2))

    # Remove draft once published
    draft_path = DRAFTS_DIR / f"{report_id}.json"
    if draft_path.exists():
        draft_path.unlink()

    return {"status": "published", "id": report_id}


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/definitions/{report_id}")
async def delete_definition(report_id: str):
    deleted = False
    for directory in (DRAFTS_DIR, DEFINITIONS_DIR):
        path = directory / f"{report_id}.json"
        if path.exists():
            path.unlink()
            deleted = True
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    return {"status": "deleted", "id": report_id}
