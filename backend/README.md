# ORVIX — Backend Service

The ORVIX backend is a high-performance FastAPI service providing real-time disaster event tracking from NASA EONET, Copernicus Data Space Ecosystem (CDSE) Sentinel-2 optical satellite imagery tasking, local storage archiving, and MongoDB metadata persistence.

---

## 1. Quick Start (Windows)

### Prerequisites
- Python 3.10+
- `uv` package manager (recommended) or standard `venv` + `pip`

### Running with `uv`
```powershell
# From the project root
uv run --directory backend uvicorn app.main:app --port 8000 --reload
```

### Running with standard Python
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r ..\Requirements.txt
copy .env.example .env
uvicorn app.main:app --port 8000 --reload
```

---

## 2. Environment Variables (`backend/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NASA_API_KEY` | NASA Open API key | `DEMO_KEY` (Free at https://api.nasa.gov/) |
| `SENTINEL_CLIENT_ID` | Copernicus Data Space OAuth Client ID | Required for satellite tasking |
| `SENTINEL_CLIENT_SECRET`| Copernicus Data Space OAuth Client Secret | Required for satellite tasking |
| `MONGODB_URI` | MongoDB Connection URI (Optional) | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | Database collection name | `orvix` |

> [!NOTE]
> If `MONGODB_URI` is not provided, the backend continues running in fallback mode with in-memory caching and local disk storage (`backend/images/`).

---

## 3. Architecture & Service Layer

```text
backend/app/
├── main.py                     # FastAPI application entrypoint & static mount (/images)
├── config.py                   # Central pydantic-settings configuration
├── schemas.py                  # Pydantic models & ApiResponse envelope
├── routers/
│   ├── api.py                  # Primary REST API (/api/*)
│   ├── satellite.py            # Legacy compatibility routes (deprecated)
│   └── gallery.py              # Legacy gallery routes (deprecated)
└── services/
    ├── nasa_service.py         # Concurrent async NASA EONET client
    ├── sentinel_service.py     # Copernicus CDSE OAuth & Process API imagery client
    ├── token_service.py        # Thread-safe OAuth2 token cache & refresh manager
    ├── image_service.py        # Disk I/O & metadata parser for backend/images/
    ├── db_service.py           # Async Motor/pymongo persistence layer
    └── analysis/               # Typed pipeline skeleton (validator, preprocessor, spectral, model)
```

---

## 4. Primary REST Endpoints (`/api/*`)

All endpoints return a uniform response envelope:
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... },
  "error": null
}
```

- `GET /api/status` — Health check for NASA EONET, Copernicus CDSE, and MongoDB.
- `GET /api/token` — Redacted Copernicus OAuth token status and expiration countdown.
- `GET /api/disasters` — Active wildfires and severe storms concurrently fetched from NASA EONET.
- `POST /api/image` — Acquire, decode, and store a Sentinel-2 Level-2A true-colour image.
- `GET /api/latest-image` — Retrieve metadata for the most recently acquired satellite scene.
- `GET /api/gallery` — List all archived images stored in `backend/images/`.
- `DELETE /api/image/{id}` — Permanently delete an image file from disk and database.
- `GET /api/history` — Download history with optional disaster type filter.
- `GET /api/monitor` — Run batch monitoring across active incidents and download scenes.
- `GET /api/analysis/status` — Status of spectral indices and detection pipeline.
