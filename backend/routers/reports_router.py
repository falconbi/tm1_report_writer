from fastapi import APIRouter, HTTPException, Query
from services.dataset_service import fetch_dataset

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/dataset")
async def get_dataset(
    cube: str = Query(..., description="Cube name"),
    view: str = Query(..., description="View name"),
    overrides: str = Query("{}", description="JSON overrides")
):
    """Fetch dataset from a TM1 view"""
    try:
        args = {"overrides": overrides}
        data = fetch_dataset(cube, view, args)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
