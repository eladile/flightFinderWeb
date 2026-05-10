"""FastAPI application entry point for the Lazy Hopper UI."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import scheduler_service
from api.routes import airports, config, schedules, search, send

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start/stop scheduler."""
    # Startup
    if os.getenv("LAZY_HOPPER_DISABLE_SCHEDULER") != "1":
        scheduler_service.start()
    yield
    # Shutdown
    scheduler_service.shutdown()


app = FastAPI(title="Lazy Hopper API", version="1.0.0", lifespan=lifespan)

# CORS for dev (React runs on :7777)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:7777"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}

# Include route modules
app.include_router(airports.router)
app.include_router(config.router)
app.include_router(schedules.router)
app.include_router(search.router)
app.include_router(send.router)

# Serve React build if it exists (for `make run`)
web_dist = Path(__file__).parent.parent / "web" / "dist"
if web_dist.exists() and web_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(web_dist), html=True), name="static")
    log.info(f"Serving static files from {web_dist}")
else:
    log.info("web/dist not found; skipping static mount")
