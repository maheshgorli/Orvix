"""
REST API router — all endpoints live under the /api prefix.

Every endpoint returns ApiResponse:
    { "success": bool, "message": str, "data": <model> | null, "error": str | null }

Endpoints
---------
GET    /api/status          — platform + dependency health check
GET    /api/token           — current OAuth token info (redacted)
GET    /api/latest-image    — metadata for the most recently saved image
POST   /api/image           — fetch + save a Sentinel-2 image (body: ImageRequest)
GET    /api/gallery         — all stored images, newest first
GET    /api/disasters       — active NASA EONET events (wildfires + storms)
GET    /api/history         — alias for gallery, future-ready for richer filtering
DELETE /api/image/{id}      — delete a stored image by filename
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Path, Query

from app.schemas import (
    ApiResponse,
    DeleteData,
    DisasterEvent,
    DisastersData,
    GalleryData,
    ImageData,
    ImageRequest,
    MonitorData,
    MonitorDownloaded,
    MonitorFailed,
    ServiceStatus,
    StatusData,
    TokenData,
    SpectralRequest,
    DetectionRequest,
    RiskRequest,
    AlertCreateRequest,
    AlertStatusUpdateRequest,
    MonitoringJobCreateRequest,
)
from app.services.image_service import image_service
from app.services.nasa_service import nasa_service, NasaServiceError
from app.services.sentinel_service import (
    sentinel_service,
    SentinelServiceError,
    AuthenticationError,
)
from app.services.token_service import token_service
from app.services.db_service import db_service
from app.services.analysis import analysis_pipeline
from app.services.processing_service import processing_service
from app.services.detection_service import detection_service
from app.services.risk_service import risk_service
from app.services.alert_service import alert_service
from app.services.monitoring_service import monitoring_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["API"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _saved_to_image_data(saved, extra: dict | None = None) -> ImageData:
    """Convert a SavedImage to an ImageData schema, optionally merging extra fields."""
    d = saved.to_dict()
    merged = {**d, **(extra or {})}
    # Build kwargs with defaults matching ImageData field types so required
    # str/int fields never receive None (which Pyright rejects).
    kwargs: dict = {}
    for k, field_info in ImageData.model_fields.items():
        value = merged.get(k)
        if value is not None:
            kwargs[k] = value
        elif field_info.default is not None:
            # Pydantic field has its own default — omit so it kicks in
            pass
        else:
            kwargs[k] = value
    return ImageData(**kwargs)


# ── GET /api/status ────────────────────────────────────────────────────────────

@router.get(
    "/status",
    response_model=ApiResponse[StatusData],
    summary="Platform health check",
    description="Reports reachability of NASA EONET, Sentinel Hub OAuth, and MongoDB database concurrently.",
)
async def get_status() -> ApiResponse[StatusData]:
    def _check_sentinel() -> tuple[ServiceStatus, bool]:
        try:
            token = token_service.get_token()
            return ServiceStatus(
                name="Sentinel Hub (CDSE)",
                reachable=True,
                status_code=200,
                message=(
                    f"Authenticated — token valid for "
                    f"{round(token.seconds_remaining)} s."
                ),
            ), True
        except (AuthenticationError, EnvironmentError) as exc:
            return ServiceStatus(
                name="Sentinel Hub (CDSE)",
                reachable=False,
                status_code=None,
                message=str(exc),
            ), False

    loop = asyncio.get_running_loop()
    sentinel_task = loop.run_in_executor(None, _check_sentinel)
    nasa_task = nasa_service.check_api_status_async()
    db_task = db_service.check_connection_async()

    nasa_status, (sentinel_status, sentinel_ok), db_status = await asyncio.gather(
        nasa_task,
        sentinel_task,
        db_task,
    )

    services: list[ServiceStatus] = [
        ServiceStatus(
            name="NASA EONET",
            reachable=nasa_status["reachable"],
            status_code=nasa_status.get("status_code"),
            message=nasa_status["message"],
        ),
        sentinel_status,
        ServiceStatus(
            name="MongoDB Database",
            reachable=db_status["reachable"],
            status_code=200 if db_status["reachable"] else None,
            message=db_status["message"],
        ),
    ]

    all_ok = nasa_status["reachable"] and sentinel_ok
    return ApiResponse.ok(
        data=StatusData(services=services),
        message="All services operational." if (all_ok and db_status["reachable"]) else "One or more services unavailable or unconfigured.",
    )


# ── GET /api/token ─────────────────────────────────────────────────────────────

@router.get(
    "/token",
    response_model=ApiResponse[TokenData],
    summary="OAuth token info",
    description=(
        "Returns the current cached CDSE OAuth token metadata. "
        "The access_token value is redacted for security."
    ),
)
def get_token() -> ApiResponse[TokenData]:
    try:
        token = token_service.get_token()
    except EnvironmentError as exc:
        return ApiResponse.fail(
            error=str(exc),
            message="Sentinel Hub credentials are not configured.",
        )
    except AuthenticationError as exc:
        return ApiResponse.fail(
            error=str(exc),
            message="OAuth authentication failed.",
        )

    summary = token.redacted_summary()
    return ApiResponse.ok(
        data=TokenData(
            access_token=summary["access_token"],
            expires_in=summary["expires_in"],
            token_type=summary["token_type"],
            seconds_remaining=summary["seconds_remaining"],
        ),
        message=f"Token valid — {summary['seconds_remaining']} seconds remaining.",
    )


# ── GET /api/latest-image ──────────────────────────────────────────────────────

@router.get(
    "/latest-image",
    response_model=ApiResponse[ImageData],
    summary="Most recently saved satellite image",
    description="Returns metadata for the newest image in backend/images/.",
)
def get_latest_image() -> ApiResponse[ImageData]:
    images = image_service.list_images()
    if not images:
        return ApiResponse.fail(
            error="No images found.",
            message="No satellite images have been saved yet. "
                    "Call POST /api/image or GET /api/disasters to download images.",
        )
    latest = images[0]
    return ApiResponse.ok(
        data=_saved_to_image_data(latest),
        message=f"Latest image: {latest.filename}",
    )


# ── POST /api/image ────────────────────────────────────────────────────────────

@router.post(
    "/image",
    response_model=ApiResponse[ImageData],
    summary="Fetch and save a Sentinel-2 image",
    description=(
        "Downloads a true-colour Sentinel-2 image for the given coordinates "
        "and date range, saves the image to disk, and records metadata in the database."
    ),
)
async def post_image(body: ImageRequest) -> ApiResponse[ImageData]:
    logger.info(
        "POST /api/image — lat=%.4f lon=%.4f  %s→%s  res=%dm",
        body.latitude, body.longitude,
        body.date_from, body.date_to, body.resolution,
    )

    # Validate date ordering
    if body.date_from >= body.date_to:
        return ApiResponse.fail(
            error=f"date_from ({body.date_from}) must be before date_to ({body.date_to}).",
            message="Invalid date range.",
        )

    try:
        result = sentinel_service.fetch_image(
            latitude=body.latitude,
            longitude=body.longitude,
            date_from=body.date_from,
            date_to=body.date_to,
            resolution=body.resolution,
            bbox_size=body.bbox_size,
        )
        saved = image_service.save(
            array=result.array,
            event_type=body.event_type,
            latitude=body.latitude,
            longitude=body.longitude,
        )
    except ValueError as exc:
        await db_service.log_acquisition(body.model_dump(), "failed", error_message=str(exc))
        return ApiResponse.fail(error=str(exc), message="Invalid request parameters.")
    except EnvironmentError as exc:
        await db_service.log_acquisition(body.model_dump(), "failed", error_message=str(exc))
        return ApiResponse.fail(error=str(exc), message="Sentinel Hub credentials are not configured.")
    except AuthenticationError as exc:
        await db_service.log_acquisition(body.model_dump(), "failed", error_message=str(exc))
        return ApiResponse.fail(error=str(exc), message="Sentinel Hub authentication failed.")
    except SentinelServiceError as exc:
        await db_service.log_acquisition(body.model_dump(), "failed", error_message=str(exc))
        return ApiResponse.fail(error=str(exc), message="Sentinel Hub imagery request failed.")
    except OSError as exc:
        await db_service.log_acquisition(body.model_dump(), "failed", error_message=str(exc))
        return ApiResponse.fail(error=str(exc), message="Failed to save image to disk.")

    extra = {
        "resolution_meters": result.meta.resolution_meters,
        "image_size_pixels": result.meta.image_size_pixels,
        "date_from":         body.date_from,
        "date_to":           body.date_to,
        "bbox":              result.meta.bbox,
        "data_collection":   result.meta.data_collection,
    }
    image_data_obj = _saved_to_image_data(saved, extra)

    # Persist metadata to database (image file remains on disk)
    try:
        await db_service.save_image_metadata(image_data_obj.model_dump())
        await db_service.log_acquisition(
            body.model_dump(),
            status="success",
            result_summary={"filename": saved.filename, "file_size_bytes": saved.file_size_bytes},
        )
    except Exception as exc:
        logger.warning("Database persistence error for image '%s': %s", saved.filename, exc)

    return ApiResponse.ok(
        data=image_data_obj,
        message=f"Image saved — {saved.filename} ({saved.file_size_bytes:,} bytes).",
    )


# ── GET /api/gallery ───────────────────────────────────────────────────────────

@router.get(
    "/gallery",
    response_model=ApiResponse[GalleryData],
    summary="All stored satellite images",
    description="Returns metadata for every image in backend/images/, newest first.",
)
def get_gallery() -> ApiResponse[GalleryData]:
    images = image_service.list_images()
    image_data = [_saved_to_image_data(img) for img in images]
    return ApiResponse.ok(
        data=GalleryData(total=len(image_data), images=image_data),
        message=f"{len(image_data)} image(s) found.",
    )


# ── GET /api/disasters ─────────────────────────────────────────────────────────

@router.get(
    "/disasters",
    response_model=ApiResponse[DisastersData],
    summary="Active NASA EONET disaster events",
    description=(
        "Returns currently active wildfire and severe-storm events from NASA EONET concurrently. "
        "Use the `days` parameter to restrict to events within the last N days."
    ),
)
async def get_disasters(
    days: int = Query(
        default=None, ge=1, le=365,
        description="Restrict to events within the last N days (optional).",
    ),
    category: str = Query(
        default=None,
        description="Filter by EONET category id, e.g. 'wildfires', 'severeStorms', 'floods'. "
                    "Omit to return all active disaster types.",
    ),
    status: str = Query(
        default="open",
        description="Filter by event status: 'open' (active), 'closed' (historical), or 'all'.",
    ),
) -> ApiResponse[DisastersData]:
    try:
        if category:
            events = await nasa_service.fetch_events_async(category_id=category, days=days, status=status)
        else:
            events = await nasa_service.fetch_events_async(days=days, status=status)
    except NasaServiceError as exc:
        logger.error("GET /api/disasters failed: %s", exc)
        return ApiResponse.fail(
            error=str(exc),
            message="Failed to fetch events from NASA EONET.",
        )

    wf_count = sum(1 for e in events if e.category_id == "wildfires")
    st_count = sum(1 for e in events if e.category_id == "severeStorms")

    disaster_list: list[DisasterEvent] = []
    for e in events:
        ed = e.to_dict()
        disaster_list.append(DisasterEvent(
            event_id=ed.get("event_id", ""),
            title=ed.get("title", ""),
            category=ed.get("category", ""),
            category_id=ed.get("category_id", ""),
            status=ed.get("status", ""),
            coordinates=ed.get("coordinates"),
            latitude=ed.get("latitude"),
            longitude=ed.get("longitude"),
            date=ed.get("date"),
            source_url=ed.get("source_url"),
        ))

    # Persist events to MongoDB (deduplicated by event_id)
    try:
        raw_events = [e.to_dict() for e in events]
        await db_service.bulk_upsert_disaster_events(raw_events)
        asyncio.create_task(alert_service.generate_alerts_from_events(raw_events))
    except Exception as exc:
        logger.warning("Database bulk upsert error for disaster events: %s", exc)

    return ApiResponse.ok(
        data=DisastersData(
            total=len(disaster_list),
            wildfires=wf_count,
            storms=st_count,
            events=disaster_list,
        ),
        message=f"{len(disaster_list)} active event(s) — "
                f"{wf_count} wildfire(s), {st_count} storm(s).",
    )


# ── GET /api/history ───────────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=ApiResponse[GalleryData],
    summary="Image download history",
    description=(
        "Returns the full history of downloaded satellite images, newest first. "
        "Supports optional filtering by disaster_type."
    ),
)
def get_history(
    disaster_type: str = Query(
        default=None,
        description="Filter by type label, e.g. 'Wildfire', 'Severe Storm', 'Satellite Capture'.",
    ),
    limit: int = Query(
        default=100, ge=1, le=1000,
        description="Maximum number of images to return.",
    ),
) -> ApiResponse[GalleryData]:
    images = image_service.list_images()

    if disaster_type:
        images = [
            img for img in images
            if img.disaster_type.lower() == disaster_type.lower()
        ]

    images = images[:limit]
    image_data = [_saved_to_image_data(img) for img in images]

    filter_note = f" (filtered by type: {disaster_type!r})" if disaster_type else ""
    return ApiResponse.ok(
        data=GalleryData(total=len(image_data), images=image_data),
        message=f"{len(image_data)} image(s) in history{filter_note}.",
    )


# ── GET /api/monitor ───────────────────────────────────────────────────────────

@router.get(
    "/monitor",
    response_model=ApiResponse[MonitorData],
    summary="Active disasters monitoring and satellite acquisition",
    description=(
        "Fetches active wildfire and storm events concurrently from NASA EONET "
        "and attempts Sentinel-2 imagery download for events with valid coordinates."
    ),
)
async def get_monitor(
    days: int = Query(
        default=None, ge=1, le=90,
        description="Restrict to events within the last N days (optional).",
    ),
    max_images: int = Query(
        default=5, ge=1, le=20,
        description="Maximum number of satellite images to attempt downloading.",
    ),
) -> ApiResponse[MonitorData]:
    try:
        wildfires, storms = await asyncio.gather(
            nasa_service.fetch_wildfires_async(days=days),
            nasa_service.fetch_storms_async(days=days),
        )
    except NasaServiceError as exc:
        logger.error("GET /api/monitor event fetch failed: %s", exc)
        return ApiResponse.fail(
            error=str(exc),
            message="Failed to fetch disaster events from NASA EONET.",
        )

    all_events = [("wildfire", e) for e in wildfires] + [("storm", e) for e in storms]
    downloaded: list[MonitorDownloaded] = []
    failed: list[MonitorFailed] = []

    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M")
    candidates = [
        (etype, ev) for etype, ev in all_events
        if ev.coordinates and len(ev.coordinates) >= 2 and ev.latest_geometry is not None
    ][:max_images]

    for event_type, event in candidates:
        geo = event.latest_geometry
        if not geo:
            continue
        lat, lon = geo.latitude, geo.longitude
        filename = f"{event_type}_{timestamp}_lat{lat:.4f}_lon{lon:.4f}.png"

        try:
            result = sentinel_service.fetch_image(latitude=lat, longitude=lon)
            saved = image_service.save(
                array=result.array,
                event_type=event_type,
                latitude=lat,
                longitude=lon,
                filename=filename,
            )
            downloaded.append(MonitorDownloaded(
                event_id=event.event_id,
                title=event.title,
                type=event_type,
                image_url=f"http://127.0.0.1:8000/{saved.image_path}",
                filename=saved.filename,
                latitude=lat,
                longitude=lon,
            ))
        except (SentinelServiceError, AuthenticationError, EnvironmentError, OSError, ValueError) as exc:
            logger.warning("Image download failed for %s: %s", event.event_id, exc)
            failed.append(MonitorFailed(
                event_id=event.event_id,
                title=event.title,
                error=str(exc),
            ))

    monitor_result = MonitorData(
        wildfires=len(wildfires),
        storms=len(storms),
        total_events=len(all_events),
        images_downloaded=len(downloaded),
        images_failed=len(failed),
        downloaded=downloaded,
        failed=failed,
    )

    # Persist monitoring session record in MongoDB
    try:
        await db_service.save_monitoring_session(monitor_result.model_dump())
    except Exception as exc:
        logger.warning("Failed to record monitoring session in DB: %s", exc)

    return ApiResponse.ok(
        data=monitor_result,
        message=f"Monitoring completed — {len(downloaded)} image(s) downloaded, {len(failed)} failed.",
    )


# ── GET /api/analysis/status ───────────────────────────────────────────────────

@router.get(
    "/analysis/status",
    response_model=ApiResponse[dict],
    summary="Image analysis pipeline component status",
    description=(
        "Reports the implementation status of all image analysis components: "
        "validation, preprocessing, spectral indices (NDVI, NBR), model inference, and detection results. "
        "Unimplemented components are strictly labelled 'pending' with no fake data."
    ),
)
def get_analysis_status() -> ApiResponse[dict]:
    status = analysis_pipeline.get_status()
    return ApiResponse.ok(
        data=status,
        message="Analysis pipeline specifications defined; implementation status reported.",
    )


# ── DELETE /api/image/{id} ─────────────────────────────────────────────────────

@router.delete(
    "/image/{image_id}",
    response_model=ApiResponse[DeleteData],
    summary="Delete a stored image",
    description=(
        "Permanently deletes a stored image by its filename. "
        "The `id` path parameter is the full filename "
        "(e.g. `wildfire_2026-07-19_13-00_lat17.3850_lon78.4870.png`)."
    ),
)
def delete_image(
    image_id: str = Path(
        description="The filename of the image to delete (including .png extension).",
    ),
) -> ApiResponse[DeleteData]:
    try:
        deleted = image_service.delete(image_id)
    except ValueError as exc:
        return ApiResponse.fail(
            error=str(exc),
            message="Invalid image identifier.",
        )
    except OSError as exc:
        return ApiResponse.fail(
            error=str(exc),
            message=f"Failed to delete {image_id}.",
        )

    if not deleted:
        return ApiResponse.fail(
            error=f"File not found: {image_id}",
            message=f"Image '{image_id}' does not exist.",
        )

    return ApiResponse.ok(
        data=DeleteData(filename=image_id, deleted=True),
        message=f"Image '{image_id}' deleted successfully.",
    )


# ── POST /api/processing/spectral ─────────────────────────────────────────────

@router.post(
    "/processing/spectral",
    summary="Compute spectral indices on satellite imagery",
    description="Calculates NDVI, NBR, NDWI, or VARI optical proxies and generates colorized heatmaps.",
)
def compute_spectral_index(body: SpectralRequest) -> ApiResponse[dict]:
    try:
        result = processing_service.compute_spectral_index(
            image_path_or_array=body.filename,
            index_type=body.index_type,
            source_filename=body.filename,
        )
        return ApiResponse.ok(
            data={
                "source_filename": result.source_filename,
                "processed_filename": result.processed_filename,
                "processed_image_url": result.processed_image_url,
                "processed_image_path": result.processed_image_path,
                "metrics": {
                    "index_name": result.metrics.index_name,
                    "is_multispectral": result.metrics.is_multispectral,
                    "formula": result.metrics.formula,
                    "mean_value": result.metrics.mean_value,
                    "min_value": result.metrics.min_value,
                    "max_value": result.metrics.max_value,
                    "std_dev": result.metrics.std_dev,
                    "coverage_percentage": result.metrics.coverage_percentage,
                    "histogram_bins": result.metrics.histogram_bins,
                    "histogram_counts": result.metrics.histogram_counts,
                    "notes": result.metrics.notes,
                },
                "created_at": result.created_at,
            },
            message=f"Successfully generated {body.index_type.upper()} spectral index map.",
        )
    except FileNotFoundError as exc:
        return ApiResponse.fail(error=str(exc), message="Source image not found.")
    except Exception as exc:
        logger.error("Spectral processing failed: %s", exc)
        return ApiResponse.fail(error=str(exc), message="Failed to compute spectral index.")


# ── POST /api/analysis/detect ─────────────────────────────────────────────────

@router.post(
    "/analysis/detect",
    summary="Run AI & Computer Vision hazard detection",
    description="Detects wildfire hotspots, smoke plumes, flood inundation, or spatial anomalies.",
)
def run_hazard_detection(body: DetectionRequest) -> ApiResponse[dict]:
    try:
        result = detection_service.run_detection(
            image_path_or_filename=body.filename,
            detection_type=body.detection_type,
            sensitivity=body.sensitivity,
        )
        return ApiResponse.ok(
            data={
                "source_filename": result.source_filename,
                "overlay_filename": result.overlay_filename,
                "overlay_image_url": result.overlay_image_url,
                "overlay_image_path": result.overlay_image_path,
                "model_name": result.model_name,
                "model_version": result.model_version,
                "total_detections": result.total_detections,
                "detections": [
                    {
                        "label": d.label,
                        "confidence": d.confidence,
                        "bbox": d.bbox,
                        "area_pixels": d.area_pixels,
                        "estimated_hectares": d.estimated_hectares,
                        "intensity": d.intensity,
                    }
                    for d in result.detections
                ],
                "summary_message": result.summary_message,
                "created_at": result.created_at,
            },
            message=result.summary_message,
        )
    except FileNotFoundError as exc:
        return ApiResponse.fail(error=str(exc), message="Source image not found.")
    except Exception as exc:
        logger.error("Hazard detection failed: %s", exc)
        return ApiResponse.fail(error=str(exc), message="Hazard detection analysis failed.")


# ── POST /api/risk/assess ─────────────────────────────────────────────────────

@router.post(
    "/risk/assess",
    summary="Evaluate geospatial multi-hazard risk",
    description="Calculates composite risk score (0-100), hazard proximity, and operational precautions.",
)
async def assess_geospatial_risk(body: RiskRequest) -> ApiResponse[dict]:
    try:
        result = await risk_service.evaluate_risk(
            latitude=body.latitude,
            longitude=body.longitude,
            radius_km=body.radius_km,
        )
        return ApiResponse.ok(
            data={
                "latitude": result.latitude,
                "longitude": result.longitude,
                "radius_km": result.radius_km,
                "risk_score": result.risk_score,
                "risk_level": result.risk_level,
                "primary_threat": result.primary_threat,
                "nearby_hazards_count": result.nearby_hazards_count,
                "nearest_hazards": [
                    {
                        "event_id": h.event_id,
                        "title": h.title,
                        "category": h.category,
                        "distance_km": h.distance_km,
                        "bearing": h.bearing,
                        "latitude": h.latitude,
                        "longitude": h.longitude,
                        "detection_date": h.detection_date,
                    }
                    for h in result.nearest_hazards
                ],
                "factors": {
                    "proximity_factor": result.factors.proximity_factor,
                    "density_factor": result.factors.density_factor,
                    "seasonality_factor": result.factors.seasonality_factor,
                    "moisture_aridity_factor": result.factors.moisture_aridity_factor,
                },
                "recommendations": result.recommendations,
                "model_version": result.model_version,
                "evaluated_at": result.evaluated_at,
            },
            message=f"Risk evaluated: {result.risk_level} ({result.risk_score}/100) — {result.primary_threat}",
        )
    except Exception as exc:
        logger.error("Risk assessment failed: %s", exc)
        return ApiResponse.fail(error=str(exc), message="Geospatial risk assessment failed.")


# ── Alerts Management ─────────────────────────────────────────────────────────

@router.get(
    "/alerts",
    summary="List system hazard alerts",
    description="Returns active, acknowledged, or resolved alerts.",
)
def get_alerts(
    status: Optional[str] = Query(default=None, description="active | acknowledged | resolved | all"),
    severity: Optional[str] = Query(default=None, description="CRITICAL | HIGH | MEDIUM | INFO | all"),
    limit: int = Query(default=50, ge=1, le=200),
) -> ApiResponse[list[dict]]:
    alerts = alert_service.list_alerts(status=status, severity=severity, limit=limit)
    return ApiResponse.ok(
        data=[a.to_dict() for a in alerts],
        message=f"{len(alerts)} alert(s) retrieved.",
    )


@router.post(
    "/alerts",
    summary="Create a custom hazard alert",
)
async def create_alert(body: AlertCreateRequest) -> ApiResponse[dict]:
    alert = await alert_service.create_alert(
        title=body.title,
        category=body.category,
        severity=body.severity,
        latitude=body.latitude,
        longitude=body.longitude,
        description=body.description,
        source_event_id=body.source_event_id,
    )
    return ApiResponse.ok(data=alert.to_dict(), message="Alert created successfully.")


@router.post(
    "/alerts/{alert_id}/status",
    summary="Update alert status",
)
def update_alert_status(alert_id: str, body: AlertStatusUpdateRequest) -> ApiResponse[dict]:
    updated = alert_service.update_alert_status(alert_id=alert_id, new_status=body.status)
    if not updated:
        return ApiResponse.fail(error=f"Alert '{alert_id}' not found.", message="Alert update failed.")
    return ApiResponse.ok(data=updated.to_dict(), message=f"Alert status updated to {body.status}.")


@router.get(
    "/alerts/rules",
    summary="Get alert threshold configuration",
)
def get_alert_rules() -> ApiResponse[dict]:
    return ApiResponse.ok(data=alert_service.get_rules().to_dict(), message="Alert rules retrieved.")


@router.post(
    "/alerts/rules",
    summary="Update alert threshold configuration",
)
def update_alert_rules(body: dict) -> ApiResponse[dict]:
    updated = alert_service.update_rules(body)
    return ApiResponse.ok(data=updated.to_dict(), message="Alert threshold rules updated.")


# ── Monitoring Jobs ───────────────────────────────────────────────────────────

@router.get(
    "/monitoring/jobs",
    summary="List background monitoring sweeps",
)
def list_monitoring_jobs(limit: int = Query(default=30, ge=1, le=100)) -> ApiResponse[list[dict]]:
    jobs = monitoring_service.list_jobs(limit=limit)
    return ApiResponse.ok(data=[j.to_dict() for j in jobs], message=f"{len(jobs)} job(s) found.")


@router.post(
    "/monitoring/jobs",
    summary="Launch background monitoring job",
)
async def create_monitoring_job(body: MonitoringJobCreateRequest) -> ApiResponse[dict]:
    job = monitoring_service.create_job(
        target_name=body.target_name,
        latitude=body.latitude,
        longitude=body.longitude,
        days=body.days,
        max_images=body.max_images,
    )
    return ApiResponse.ok(data=job.to_dict(), message=f"Monitoring job {job.job_id} launched in background.")

