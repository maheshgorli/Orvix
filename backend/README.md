# ORVIX — Backend Service

The ORVIX backend is a high-performance FastAPI service providing real-time disaster event tracking from NASA EONET, provider-independent satellite imagery acquisition via Earth Search STAC (Element 84 AWS open data), Cloud-Optimized GeoTIFF (COG) multi-band processing, and persistent metadata storage.

---

## 1. Quick Start (Windows)

### Prerequisites
- Python 3.10+
- `uv` package manager (recommended) or standard `venv` + `pip`

### Running with `uv` (from workspace root)
```powershell
uv run uvicorn backend.app.main:app --port 8000 --reload
```

*Interactive Swagger API Documentation:* [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 2. Environment Configuration (`backend/.env`)

```ini
# NASA EONET API Key (Optional — default is DEMO_KEY)
NASA_API_KEY=DEMO_KEY

# Earth Search STAC (Element 84 AWS)
# Free and public open data — no credentials required!
# Collections: sentinel-2-l2a, landsat-c2-l2

# MongoDB Connection (Optional — defaults to local JSON persistence)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=orvix
```

---

## 3. Architecture & Service Layer

```text
backend/app/
├── main.py                     # FastAPI application & static mount (/images)
├── config.py                   # Central environment configuration
├── schemas.py                  # Pydantic models & ApiResponse[T] envelope
├── routers/
│   ├── api.py                  # Core REST API (/api/*)
│   ├── imagery.py              # Earth Search STAC endpoints (/api/imagery/*)
│   ├── gallery.py              # Gallery downloads & file streaming (/api/gallery/*)
│   └── satellite.py            # Legacy compatibility routes (deprecated)
└── services/
    ├── earth_search.py         # STAC discovery, COG windowing, RGB composite & spectral indices
    ├── nasa_service.py         # Concurrent async NASA EONET client
    ├── image_service.py        # Disk I/O & metadata parser for backend/images/
    ├── db_service.py           # Async Motor/pymongo layer with local JSON fallback
    ├── processing_service.py   # Contrast stretching, percentile normalization, index heatmaps
    ├── detection_service.py    # OpenCV & morphological disaster feature detectors
    └── risk_service.py         # Multi-factor geospatial risk calculation
```

---

## 4. Key Endpoints

All endpoints return a uniform envelope:
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... },
  "error": null
}
```

### Satellite Imagery (`/api/imagery/*`)
- `GET /api/imagery/scenes` — Search Earth Search STAC for Sentinel-2 or Landsat scenes matching lat, lon, dates, and max cloud cover.
- `POST /api/imagery/acquire` — Acquire scene, download/composite True Color RGB, False Color Infrared, NDVI, NDWI, NBR, and persist metadata.
- `GET /api/imagery/latest` — Retrieve most recently acquired satellite scene.
- `GET /api/imagery/{scene_id}` — Get metadata for a specific scene or acquisition.
- `GET /api/imagery/collections` — List supported STAC collections.

### Gallery & Downloads (`/api/gallery/*`)
- `GET /api/gallery` — List all archived images and STAC acquisitions with search and filters.
- `GET /api/gallery/{id}/download` — Stream binary image (PNG or GeoTIFF) with Content-Disposition headers.
- `DELETE /api/image/{id}` — Permanently delete an image file from disk and database.

### System Diagnostics & Disaster Intelligence
- `GET /api/status` — Health check for NASA EONET, Earth Search STAC, MongoDB, Local Storage, and Processing Engine.
- `GET /api/disasters` — Active wildfires and severe storms concurrently fetched from NASA EONET.
- `GET /api/monitor` — Run batch monitoring across active incidents and download scenes.
