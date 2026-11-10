"""
Satellite router.

All business logic lives in the service layer:
  - nasa_service    → EONET event fetching + formatting
  - sentinel_service → Sentinel Hub auth + imagery
  - image_service   → file persistence

This router is responsible only for:
  - Declaring HTTP endpoints and their parameters
  - Calling the right service methods
  - Shaping the HTTP response
  - Translating service exceptions into appropriate HTTP responses

Endpoints
---------
GET /satellite          — EONET API health check
GET /wildfires          — active wildfire events
GET /storms             — active severe-storm events
GET /monitor            — fetch events + download a Sentinel image per event
GET /satellite-image    — download a single image by lat/lon + date range
GET /sentinel-test      — Sentinel Hub OAuth smoke-test
GET /auth/token         — return (redacted) current OAuth token info
"""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.services.nasa_service import nasa_service, NasaServiceError
from app.services.sentinel_service import (
    sentinel_service,
    SentinelServiceError,
    AuthenticationError,
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    DEFAULT_DATE_FROM,
    DEFAULT_DATE_TO,
    DEFAULT_RESOLUTION,
    DEFAULT_BBOX_SIZE,
)
from app.services.image_service import image_service
from app.services.token_service import token_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ── NASA / EONET endpoints ────────────────────────────────────────────────────

@router.get("/satellite", deprecated=True, tags=["Legacy"])
def satellite():
    """(Deprecated) EONET API reachability check. Use GET /api/status instead."""
    return nasa_service.check_api_status()


@router.get("/wildfires", deprecated=True, tags=["Legacy"])
async def get_wildfires(
    days: int = Query(default=None, ge=1, le=365, description="Restrict to events within the last N days"),
):
    """(Deprecated) Return active wildfire events from NASA EONET. Use GET /api/disasters?category=wildfires instead."""
    try:
        events = await nasa_service.fetch_wildfires_async(days=days)
    except NasaServiceError as exc:
        logger.error("Wildfire fetch failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    return [e.to_dict() for e in events]


@router.get("/storms", deprecated=True, tags=["Legacy"])
async def get_storms(
    days: int = Query(default=None, ge=1, le=365, description="Restrict to events within the last N days"),
):
    """(Deprecated) Return active severe-storm events from NASA EONET. Use GET /api/disasters?category=severeStorms instead."""
    try:
        events = await nasa_service.fetch_storms_async(days=days)
    except NasaServiceError as exc:
        logger.error("Storm fetch failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    return [e.to_dict() for e in events]


# ── Sentinel Hub endpoints ────────────────────────────────────────────────────

@router.get("/sentinel-test", deprecated=True, tags=["Legacy"])
def sentinel_test():
    """(Deprecated) Validate Sentinel Hub OAuth credentials. Use GET /api/status or GET /api/token instead."""
    try:
        token = sentinel_service.get_token()
    except EnvironmentError as exc:
        return {"authenticated": False, "error": str(exc)}
    except AuthenticationError as exc:
        return {"authenticated": False, "error": str(exc)}
    return {
        "authenticated":   True,
        "token_type":      token.token_type,
        "expires_in":      token.expires_in,
        "seconds_remaining": round(token.seconds_remaining),
    }


@router.get("/auth/token", deprecated=True, tags=["Legacy"])
def auth_token():
    """(Deprecated) Return the current (cached) CDSE OAuth token summary. Use GET /api/token instead."""
    try:
        token = token_service.get_token()
    except EnvironmentError as exc:
        return {"success": False, "error": str(exc)}
    except AuthenticationError as exc:
        return {"success": False, "error": str(exc)}
    return {"success": True, **token.redacted_summary()}


@router.get("/satellite-image", deprecated=True, tags=["Legacy"])
def satellite_image(
    latitude:  float = Query(default=DEFAULT_LATITUDE,  ge=-90,   le=90,   description="Centre latitude"),
    longitude: float = Query(default=DEFAULT_LONGITUDE, ge=-180,  le=180,  description="Centre longitude"),
    date_from: str   = Query(default=DEFAULT_DATE_FROM,            description="Start date YYYY-MM-DD"),
    date_to:   str   = Query(default=DEFAULT_DATE_TO,              description="End date   YYYY-MM-DD"),
    resolution: int  = Query(default=DEFAULT_RESOLUTION, ge=10, le=1000,   description="Metres per pixel"),
    bbox_size: float = Query(default=DEFAULT_BBOX_SIZE,  gt=0,  le=5.0,    description="BBox half-extent in degrees"),
):
    """(Deprecated) Download a single Sentinel-2 true-colour image and save it to disk. Use POST /api/image instead."""
    try:
        result = sentinel_service.fetch_image(
            latitude=latitude,
            longitude=longitude,
            date_from=date_from,
            date_to=date_to,
            resolution=resolution,
            bbox_size=bbox_size,
        )
        saved = image_service.save(
            array=result.array,
            event_type="satellite",
            latitude=latitude,
            longitude=longitude,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except (AuthenticationError, EnvironmentError) as exc:
        return {"success": False, "error": str(exc)}
    except SentinelServiceError as exc:
        return {"success": False, "error": str(exc)}

    return {
        "success":           True,
        "image_url":         f"http://127.0.0.1:8000/{saved.image_path}",
        **saved.to_dict(),
        "bbox":              result.meta.bbox,
        "resolution_meters": result.meta.resolution_meters,
        "image_size_pixels": result.meta.image_size_pixels,
        "date_from":         date_from,
        "date_to":           date_to,
        "data_collection":   result.meta.data_collection,
    }


@router.get("/monitor", deprecated=True, tags=["Legacy"])
async def monitor(
    days: int = Query(default=None, ge=1, le=90, description="Restrict to events within the last N days"),
):
    """(Deprecated) Fetch active wildfire + storm events and download a Sentinel-2 image. Use GET /api/monitor instead."""
    from app.routers.api import get_monitor
    res = await get_monitor(days=days)
    if not res.success or res.data is None:
        raise HTTPException(status_code=502, detail=res.error or res.message)
    d = res.data
    return {
        "success":           True,
        "wildfires":        d.wildfires,
        "storms":           d.storms,
        "total_events":     d.total_events,
        "images_downloaded": d.images_downloaded,
        "images_failed":    d.images_failed,
        "downloaded":       [item.model_dump() for item in d.downloaded],
        "failed":           [item.model_dump() for item in d.failed],
    }
