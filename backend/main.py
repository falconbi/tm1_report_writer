from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import uvicorn

from db.database import create_db_and_tables, IMAGES_DIR
from routers.tm1_router import router as tm1_router
from routers.reports_router import router as reports_router
from routers.packs_router import router as packs_router
from routers.admin_router import router as admin_router
from routers.notes_router import router as notes_router
from routers.visuals_router import router as visuals_router
from routers.images_router import router as images_router
from routers.folders_router import router as folders_router

load_dotenv()

app = FastAPI(
    title="TM1 Report Writer",
    description="Modern web app for TM1 Planning Analytics reporting",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB tables on startup
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Serve uploaded images as static files at /images/<filename>
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

# Include routers
app.include_router(tm1_router)
app.include_router(reports_router)
app.include_router(packs_router)
app.include_router(admin_router)
app.include_router(notes_router)
app.include_router(visuals_router)
app.include_router(images_router)
app.include_router(folders_router)

@app.get("/")
async def root():
    return {"message": "TM1 Report Writer API is running ✅"}

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Backend is up"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080)
