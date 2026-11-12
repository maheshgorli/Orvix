
import sys
from pathlib import Path

# Ensure both the backend/ directory (for 'app.*') and root directory (for 'backend.app.*') are in sys.path
_current_file = Path(__file__).resolve()
_backend_dir = _current_file.parent.parent
_project_root = _backend_dir.parent

for _p in (_backend_dir, _project_root):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import configuration first — it loads environment variables
from app.config import settings
from app.routers.api import router as api_router
from app.routers.satellite import router as satellite_router
from app.routers.gallery import router as gallery_router
from app.routers.imagery import router as imagery_router


# ── Logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

logger = logging.getLogger(__name__)


# ── FastAPI Application ──────────────────────────────────────────────────
app = FastAPI(
    title="ORVIX - Earth Intelligence Systems",
    description=(
        "REST API for satellite imagery, NASA EONET disaster events, "
        "and Copernicus Sentinel-2 integration.\n\n"
        "All `/api/*` endpoints return a uniform JSON envelope:\n"
        "```json\n"
        '{"success": true, "message": "...", "data": {}, "error": null}\n'
        "```"
    ),
    version="1.0.0",
)


# ── CORS Configuration ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Image Storage ────────────────────────────────────────────────────────
IMAGES_DIR = Path(__file__).resolve().parent.parent / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/images",
    StaticFiles(directory=str(IMAGES_DIR)),
    name="images",
)


# ── API Routers ─────────────────────────────────────────────────────────
app.include_router(api_router)
app.include_router(satellite_router)
app.include_router(gallery_router)
app.include_router(imagery_router)


# ── Startup Event ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup() -> None:
    settings.log_loaded_vars()
    logger.info("ORVIX backend started successfully")


# ── Root Endpoint ───────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
def home():
    return {
        "message": "ORVIX Earth Intelligence Systems API",
        "version": "1.0.0",
        "docs": "/docs",
        "api": {
            "status": "GET /api/status",
            "token": "GET /api/token",
            "latest_image": "GET /api/latest-image",
            "capture_image": "POST /api/image",
            "gallery": "GET /api/gallery",
            "disasters": "GET /api/disasters",
            "history": "GET /api/history",
            "delete_image": "DELETE /api/image/{filename}",
        },
        "legacy": {
            "wildfires": "/wildfires",
            "storms": "/storms",
            "monitor": "/monitor",
            "gallery": "/gallery",
            "sentinel_test": "/sentinel-test",
            "auth_token": "/auth/token",
        },
    }
