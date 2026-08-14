from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import children, sessions, wellness


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="MINDTRACE API",
    description="AI-Powered Child Wellness Screening — Hackathon Demo",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(children.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(wellness.router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "MINDTRACE",
        "tagline": "Privacy-first AI wellness screening through play",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
