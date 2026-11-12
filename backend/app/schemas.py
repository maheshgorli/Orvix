"""
Pydantic schemas for the /api/* endpoints.

Every response is wrapped in ApiResponse:
    {
        "success": true,
        "message": "Human-readable summary",
        "data": { ... }       # null on error
        "error": null         # populated on failure
    }

Keeping all schemas here makes it easy to generate an OpenAPI spec and
to maintain consistent field names across every endpoint.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field, field_validator, model_validator

T = TypeVar("T")


# ── Envelope ──────────────────────────────────────────────────────────────────

class ApiResponse(BaseModel, Generic[T]):
    """
    Standard API response wrapper.

    All /api/* endpoints return this shape so the frontend can always
    branch on `success` without inspecting HTTP status codes.
    """
    success: bool
    message: str
    data:    Optional[T]  = None
    error:   Optional[str] = None

    @classmethod
    def ok(cls, data: Any = None, message: str = "OK") -> "ApiResponse":
        return cls(success=True, message=message, data=data)

    @classmethod
    def fail(cls, error: str, message: str = "Request failed") -> "ApiResponse":
        return cls(success=False, message=message, error=error)


# ── Status / health ───────────────────────────────────────────────────────────

class ServiceStatus(BaseModel):
    name:        str
    reachable:   bool
    status_code: Optional[int] = None
    message:     str


class StatusData(BaseModel):
    api:     str = "Geo Satellite Tracking Platform"
    version: str = "1.0.0"
    services: list[ServiceStatus]


# ── Token ─────────────────────────────────────────────────────────────────────

class TokenData(BaseModel):
    access_token:      str = Field(description="Redacted — first 10 chars only")
    expires_in:        int = Field(description="Total lifetime in seconds")
    token_type:        str
    seconds_remaining: int = Field(description="Seconds until the token should be refreshed")


# ── Image request / response ──────────────────────────────────────────────────

class ImageRequest(BaseModel):
    """Body for POST /api/image."""
    latitude:   float = Field(default=17.3850,  ge=-90,   le=90,   description="Centre latitude")
    longitude:  float = Field(default=78.4867,  ge=-180,  le=180,  description="Centre longitude")
    date_from:  str   = Field(default="2024-01-01",       description="Start date YYYY-MM-DD")
    date_to:    str   = Field(default="2024-06-30",       description="End date YYYY-MM-DD")
    resolution: int   = Field(default=60,       ge=10,    le=1000, description="Metres per pixel")
    bbox_size:  float = Field(default=0.05,     gt=0,     le=5.0,  description="BBox half-extent in degrees")
    event_type: str   = Field(default="satellite",        description="Label: satellite | wildfire | storm")

    @field_validator("date_from", "date_to")
    @classmethod
    def _valid_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"Expected YYYY-MM-DD, got: {v!r}")
        return v

    @model_validator(mode="after")
    def _validate_date_range(self) -> "ImageRequest":
        d_from = datetime.strptime(self.date_from, "%Y-%m-%d").date()
        d_to = datetime.strptime(self.date_to, "%Y-%m-%d").date()
        today = date.today()
        if d_to > today:
            raise ValueError(f"date_to ({self.date_to}) cannot be in the future (today is {today.isoformat()}).")
        if d_from > d_to:
            raise ValueError(f"date_from ({self.date_from}) must be on or before date_to ({self.date_to}).")
        if (d_to - d_from).days > 365:
            raise ValueError(f"Acquisition date range cannot exceed 365 days (requested {(d_to - d_from).days} days).")
        return self


class ImageData(BaseModel):
    """Metadata returned for a single stored image."""
    filename:        str
    image_url:       str
    image_path:      str
    disaster_type:   str
    location:        str
    latitude:        Optional[float]
    longitude:       Optional[float]
    date:            str
    captured_at:     str
    file_size_bytes: int
    resolution_meters: Optional[int]  = None
    image_size_pixels: Optional[dict] = None
    date_from:       Optional[str]    = None
    date_to:         Optional[str]    = None
    bbox:            Optional[list[float]] = None
    data_collection: Optional[str]   = None
    prediction:      str = "Pending"
    confidence:      float = 0.0


# ── Gallery ───────────────────────────────────────────────────────────────────

class GalleryData(BaseModel):
    total:  int
    images: list[ImageData]


# ── Disasters ─────────────────────────────────────────────────────────────────

class DisasterEvent(BaseModel):
    event_id:    str
    title:       str
    category:    str
    category_id: str
    status:      str
    coordinates: Optional[list[float]] = None
    latitude:    Optional[float]       = None
    longitude:   Optional[float]       = None
    date:        Optional[str]         = None
    source_url:  Optional[str]         = None


class DisastersData(BaseModel):
    total:      int
    wildfires:  int
    storms:     int
    events:     list[DisasterEvent]


# ── Monitor / history ─────────────────────────────────────────────────────────

class MonitorDownloaded(BaseModel):
    event_id:  str
    title:     str
    type:      str
    image_url: str
    filename:  str
    latitude:  float
    longitude: float


class MonitorFailed(BaseModel):
    event_id: Optional[str] = None
    title:    Optional[str] = None
    error:    str


class MonitorData(BaseModel):
    wildfires:         int
    storms:            int
    total_events:      int
    images_downloaded: int
    images_failed:     int
    downloaded:        list[MonitorDownloaded]
    failed:            list[MonitorFailed]


# ── Delete ────────────────────────────────────────────────────────────────────

class DeleteData(BaseModel):
    filename: str
    deleted:  bool


# ── Spectral Analysis & Computer Vision ────────────────────────────────────────

class SpectralRequest(BaseModel):
    filename:   str = Field(description="Target image filename in backend/images/")
    index_type: str = Field(default="ndvi", description="One of 'ndvi', 'nbr', 'ndwi', 'vari'")


class DetectionRequest(BaseModel):
    filename:       str   = Field(description="Target image filename in backend/images/")
    detection_type: str   = Field(default="wildfire", description="wildfire | flood | anomaly | dnn_unet")
    sensitivity:    float = Field(default=0.5, ge=0.1, le=1.0, description="Detection sensitivity 0.1 to 1.0")


# ── Risk Assessment ───────────────────────────────────────────────────────────

class RiskRequest(BaseModel):
    latitude:  float = Field(ge=-90, le=90, description="Target latitude")
    longitude: float = Field(ge=-180, le=180, description="Target longitude")
    radius_km: float = Field(default=500.0, ge=10, le=5000, description="Analysis radius in km")


# ── Alerts ────────────────────────────────────────────────────────────────────

class AlertCreateRequest(BaseModel):
    title:           str
    category:        str
    severity:        str = Field(default="HIGH", description="CRITICAL | HIGH | MEDIUM | INFO")
    latitude:        Optional[float] = None
    longitude:       Optional[float] = None
    description:     str = ""
    source_event_id: Optional[str] = None


class AlertStatusUpdateRequest(BaseModel):
    status: str = Field(description="active | acknowledged | resolved")


# ── Monitoring Jobs ───────────────────────────────────────────────────────────

class MonitoringJobCreateRequest(BaseModel):
    target_name: str = Field(default="Planetary Hazard Sweep")
    latitude:    Optional[float] = None
    longitude:   Optional[float] = None
    days:        int = Field(default=30, ge=1, le=90)
    max_images:  int = Field(default=3, ge=1, le=20)


# ── Imagery / Earth Search Schemas ───────────────────────────────────────────

class SceneItem(BaseModel):
    scene_id:        str
    collection:      str
    datetime:        Optional[str] = None
    date:            Optional[str] = None
    cloud_cover:     float = 0.0
    bbox:            list[float] = []
    platform:        str = "Sentinel-2"
    thumbnail_url:   Optional[str] = None
    visual_url:      Optional[str] = None
    available_bands: list[str] = []
    assets:          dict[str, str] = {}


class SceneSearchData(BaseModel):
    total:  int
    scenes: list[SceneItem]


class ImageryAcquireRequest(BaseModel):
    scene_id:     Optional[str]   = None
    latitude:     float           = Field(default=44.3187, ge=-90, le=90)
    longitude:    float           = Field(default=-106.9325, ge=-180, le=180)
    date_from:    Optional[str]   = None
    date_to:      Optional[str]   = None
    collection:   str             = Field(default="sentinel-2-l2a")
    max_cloud:    float           = Field(default=100.0, ge=0.0, le=100.0)
    output_type:  str             = Field(default="true_color")
    resolution:   int             = Field(default=10, ge=10, le=1000)
    event_type:   str             = Field(default="satellite")
    bbox_size:    float           = Field(default=0.05, gt=0, le=5.0)


class ImageryAcquisitionData(BaseModel):
    acquisition_id:  str
    scene_id:        str
    collection:      str
    platform:        str
    datetime:        str
    date:            str
    latitude:        float
    longitude:       float
    cloud_cover:     float
    resolution:      int
    event_type:      str
    image_url:       str
    thumbnail_url:   str
    image_path:      str
    filename:        str
    file_size_bytes: int
    bbox:            list[float] = []
    bands_available: list[str] = []
    indices:         dict[str, str] = {}
    status:          str = "completed"
    created_at:      str


