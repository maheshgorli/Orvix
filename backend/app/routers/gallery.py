"""
Gallery router — handles image download, retrieval, and legacy gallery endpoints.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Path as FastPath
from fastapi.responses import FileResponse

from app.schemas import ApiResponse, ImageData
from app.services.db_service import db_service
from app.services.image_service import image_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Gallery"])

_IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "images"


@router.get("/gallery", deprecated=True, tags=["Legacy"])
def get_gallery_legacy():
    """(Deprecated) Return metadata for every stored image in backend/images/, newest first. Use GET /api/gallery instead."""
    images = image_service.list_images()
    return [img.to_dict() for img in images]


@router.get(
    "/api/gallery/{image_id}/download",
    summary="Download stored satellite raster or PNG",
    description="Streams the binary satellite image or composite directly as a download.",
)
async def download_gallery_image(
    image_id: str = FastPath(description="Image filename or scene ID"),
):
    # Guard against directory traversal
    if "/" in image_id or "\\" in image_id or ".." in image_id:
        raise HTTPException(status_code=400, detail="Invalid file identifier.")

    # Check candidates
    candidates = [
        _IMAGES_DIR / image_id,
        _IMAGES_DIR / "satellite" / image_id,
        _IMAGES_DIR / "thumbnails" / image_id,
        _IMAGES_DIR / "processed" / image_id,
        _IMAGES_DIR / f"{image_id}.png",
        _IMAGES_DIR / "satellite" / f"{image_id}_rgb.png",
    ]

    for p in candidates:
        if p.exists() and p.is_file():
            media_type = "image/png"
            if p.suffix.lower() in [".tif", ".tiff"]:
                media_type = "image/tiff"
            elif p.suffix.lower() in [".jpg", ".jpeg"]:
                media_type = "image/jpeg"

            return FileResponse(
                path=str(p),
                filename=p.name,
                media_type=media_type,
            )

    raise HTTPException(status_code=404, detail=f"Image file '{image_id}' not found.")


@router.get(
    "/api/gallery/{image_id}",
    response_model=ApiResponse[Optional[dict]],
    summary="Get single image metadata",
    description="Returns metadata for an image by filename or acquisition ID.",
)
async def get_gallery_image_details(
    image_id: str = FastPath(description="Filename or acquisition ID"),
) -> ApiResponse[Optional[dict]]:
    # Try acquisition store
    acq = await db_service.get_acquisition_by_id(image_id)
    if acq:
        return ApiResponse.ok(data=acq, message=f"Image details for {image_id}")

    # Try disk images
    images = image_service.list_images()
    for img in images:
        if img.filename == image_id or img.filename.startswith(image_id):
            return ApiResponse.ok(data=img.to_dict(), message=f"Image details for {image_id}")

    return ApiResponse.fail(error="Not found", message=f"Image '{image_id}' not found.")
