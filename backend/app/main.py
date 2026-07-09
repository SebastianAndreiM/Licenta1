
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import create_db_and_tables
from app.routers import auth, health, dashboard
from app.routers import images
from app.routers import extractions
from app.routers import ml
from app.services.extraction_worker import start_workers

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Sentinel-2 and ERA5-Land land degradation monitoring.",
    version="0.1.0"
)


origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(images.router)
app.include_router(extractions.router)
app.include_router(ml.router)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    start_workers()


@app.get("/")
async def root():
    return {
        "message": "Degradation Monitoring Tool API is running"
    }