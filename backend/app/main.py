import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .database import Base, SessionLocal, engine
from .routers import attendance, auth, candidates, clients, dashboard, meta, positions, reports, users
from .seed import seed

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.secret_key == Settings.model_fields["secret_key"].default:
        logging.getLogger("uvicorn.error").warning("HR_SECRET_KEY is not set - using the insecure default key.")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db, demo=settings.seed_demo_data)
    yield


app = FastAPI(
    title=f"{settings.app_name} API",
    description="Recruitment management for HR consultancies: clients, openings, candidate pipelines, "
    "interviews, recruiter attendance and reports.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for module in (auth, users, clients, positions, candidates, dashboard, reports, attendance, meta):
    app.include_router(module.router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.app_name}
