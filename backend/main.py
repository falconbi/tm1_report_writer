from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

from routers.tm1_router import router as tm1_router
from routers.reports_router import router as reports_router

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

# Include routers
app.include_router(tm1_router)
app.include_router(reports_router)

@app.get("/")
async def root():
    return {"message": "TM1 Report Writer API is running ✅"}

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Backend is up"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080)
