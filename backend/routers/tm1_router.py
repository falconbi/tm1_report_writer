from fastapi import APIRouter, HTTPException, Query
from core.tm1_connect import tm1_connect

router = APIRouter(prefix="/api/tm1", tags=["TM1"])

@router.get("/cubes")
async def list_cubes():
    """List all non-system cubes"""
    try:
        session = tm1_connect.get_session()
        base = tm1_connect.get_base_url()
        r = session.get(f"{base}/Cubes?$select=Name", timeout=10)
        r.raise_for_status()
        all_cubes = [item['Name'] for item in r.json().get('value', [])]
        user_cubes = [c for c in all_cubes if not c.startswith("}")]
        return {"status": "success", "cubes": user_cubes, "count": len(user_cubes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TM1 Error: {str(e)}")

@router.get("/views")
async def list_views(cube: str = Query(..., description="Cube name")):
    """List all views for a specific cube"""
    try:
        session = tm1_connect.get_session()
        base = tm1_connect.get_base_url()
        r = session.get(f"{base}/Cubes('{cube}')/Views?$select=Name", timeout=15)
        r.raise_for_status()
        views = [item['Name'] for item in r.json().get('value', [])]
        return {"status": "success", "cube": cube, "views": views, "count": len(views)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TM1 Error: {str(e)}")
