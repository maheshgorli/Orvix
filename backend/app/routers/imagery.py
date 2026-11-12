"""
Imagery router — provides Earth Search STAC scene discovery, acquisition, and processing.

All endpoints live under /api/imagery.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas import (
    ApiResponse,
    ImageryAcquireRequest,
    ImageryAcquisitionData,
    SceneItem,
    SceneSearchData,
)
from app.services.db_service import db_service
from app.services.earth_search import earth_search

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/imagery", tags=["Imagery"])


# ── GET /api/imagery/scenes ───────────────────────────────────────────────────

@router.get(
    "/scenes",
    response_model=ApiResponse[SceneSearchData],
    summary="Search satellite scenes",
    description="Searches Earth Search STAC catalogue for Sentinel-2 or Landsat scenes matching coordinates, dates, and cloud cover.",
)
async def search_scenes(
    latitude: float = Query(default=44.3187, ge=-90, le=90, description="Centre latitude"),
    longitude: float = Query(default=-106.9325, ge=-180, le=180, description="Centre longitude"),
    date_from: Optional[str] = Query(default=None, description="Start date YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="End date YYYY-MM-DD"),
    collection: str = Query(default="sentinel-2-l2a", description="STAC collection ID"),
    max_cloud: float = Query(default=100.0, ge=0.0, le=100.0, description="Max cloud cover %"),
    limit: int = Query(default=10, ge=1, le=50, description="Max number of scenes to return"),
) -> ApiResponse[SceneSearchData]:
    try:
        results = await earth_search.search_scenes(
            latitude=latitude,
            longitude=longitude,
            date_from=date_from,
            date_to=date_to,
            max_cloud=max_cloud,
            collection=collection,
            limit=limit,
        )
        items = [SceneItem(**s) for s in results]
        return ApiResponse.ok(
            data=SceneSearchData(total=len(items), scenes=items),
            message=f"Found {len(items)} satellite scenes in catalogue.",
        )
    except Exception as exc:
        logger.error("Scene search failed: %s", exc)
        return ApiResponse.fail(
            error=str(exc),
            message="Satellite scene search failed.",
        )


# ── POST /api/imagery/acquire ─────────────────────────────────────────────────

@router.post(
    "/acquire",
    response_model=ApiResponse[ImageryAcquisitionData],
    summary="Acquire and composite satellite imagery",
    description="Downloads spectral assets, generates True Color RGB and spectral indices (NDVI, NDWI, NBR), and records metadata.",
)
async def acquire_imagery(body: ImageryAcquireRequest) -> ApiResponse[ImageryAcquisitionData]:
    try:
        record = await earth_search.acquire_scene(
            scene_id=body.scene_id,
            latitude=body.latitude,
            longitude=body.longitude,
            date_from=body.date_from,
            date_to=body.date_to,
            collection=body.collection,
            max_cloud=body.max_cloud,
            output_type=body.output_type,
            resolution=body.resolution,
            event_type=body.event_type,
            bbox_size=body.bbox_size,
            compute_multispectral=True,
        )
        return ApiResponse.ok(
            data=ImageryAcquisitionData(**record),
            message=f"Acquisition successful for scene {record['scene_id']}.",
        )
    except Exception as exc:
        logger.error("Satellite acquisition failed: %s", exc)
        return ApiResponse.fail(
            error=str(exc),
            message="Satellite acquisition failed.",
        )


# ── GET /api/imagery/latest ───────────────────────────────────────────────────

@router.get(
    "/latest",
    response_model=ApiResponse[Optional[ImageryAcquisitionData]],
    summary="Most recently acquired scene",
    description="Returns metadata for the most recently acquired satellite scene.",
)
async def get_latest_acquisition() -> ApiResponse[Optional[ImageryAcquisitionData]]:
    acquisitions = await db_service.list_acquisitions(limit=1)
    if not acquisitions:
        return ApiResponse.ok(
            data=None,
            message="No satellite imagery acquisitions recorded yet.",
        )
    return ApiResponse.ok(
        data=ImageryAcquisitionData(**acquisitions[0]),
        message=f"Latest acquisition: {acquisitions[0].get('scene_id')}",
    )


# ── GET /api/imagery/{scene_id} ───────────────────────────────────────────────

@router.get(
    "/{scene_id}",
    response_model=ApiResponse[Optional[ImageryAcquisitionData]],
    summary="Acquisition details by scene ID",
    description="Returns metadata for an acquired scene by its scene_id or acquisition_id.",
)
async def get_acquisition_by_id(scene_id: str) -> ApiResponse[Optional[ImageryAcquisitionData]]:
    acq = await db_service.get_acquisition_by_id(scene_id)
    if not acq:
        return ApiResponse.fail(
            error=f"No acquisition found for ID '{scene_id}'.",
            message="Acquisition record not found.",
        )
    return ApiResponse.ok(
        data=ImageryAcquisitionData(**acq),
        message=f"Acquisition details for {scene_id}",
    )


# ── GET /api/imagery/collections ──────────────────────────────────────────────

@router.get(
    "/collections",
    response_model=ApiResponse[list[dict]],
    summary="List available satellite collections",
    description="Returns supported collections from the Earth Search catalogue.",
)
async def get_collections() -> ApiResponse[list[dict]]:
    collections = await earth_search.get_available_collections()
    return ApiResponse.ok(
        data=collections,
        message=f"Available collections: {len(collections)}",
    )

