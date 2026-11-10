# ORVIX Earth Intelligence Systems — API Reference Manual

Version: `1.0.0`  
Base URL: `http://127.0.0.1:8000`  
Interactive OpenAPI Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)  
OpenAPI JSON Specification: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## 1. Unified Response Envelope

All primary endpoints under `/api/*` return a uniform JSON envelope:

```json
{
  "success": true,
  "message": "Human-readable summary message",
  "data": { ... },
  "error": null
}
```

On failure:
```json
{
  "success": false,
  "message": "Human-readable error description",
  "data": null,
  "error": "Detailed diagnostic information or stack description"
}
```

---

## 2. Primary Endpoints (`/api/*` — Single Source of Truth)

### `GET /api/status`
Health check reporting concurrent reachability for NASA EONET, Copernicus CDSE OAuth, and MongoDB.

- **Method**: `GET`
- **Response**: `ApiResponse[StatusData]`
- **Example Response**:
```json
{
  "success": true,
  "message": "All services operational.",
  "data": {
    "api": "Geo Satellite Tracking Platform",
    "version": "1.0.0",
    "services": [
      {
        "name": "NASA EONET",
        "reachable": true,
        "status_code": 200,
        "message": "NASA EONET API is reachable."
      },
      {
        "name": "Sentinel Hub (CDSE)",
        "reachable": true,
        "status_code": 200,
        "message": "Authenticated — token valid for 3540 s."
      },
      {
        "name": "MongoDB Database",
        "reachable": true,
        "status_code": 200,
        "message": "Connected to MongoDB database 'orvix'."
      }
    ]
  },
  "error": null
}
```

---

### `GET /api/token`
Returns metadata and remaining validity for the cached Copernicus Data Space Ecosystem (CDSE) OAuth2 token.

- **Method**: `GET`
- **Response**: `ApiResponse[TokenData]`
- **Security**: The `access_token` string is redacted (first 10 chars shown).

---

### `GET /api/disasters`
Retrieves active natural disaster events from NASA EONET. Queries wildfires and severe storms concurrently in parallel via `httpx` and `asyncio.gather`.

- **Method**: `GET`
- **Query Parameters**:
  * `days` (integer, optional, `1..365`): Restrict to events reported within the last N days.
  * `category` (string, optional): Filter by category identifier (e.g. `wildfires`, `severeStorms`).
- **Response**: `ApiResponse[DisastersData]`
- **Persistence**: Fetched events are automatically upserted and deduplicated into the `disaster_events` MongoDB collection by `event_id`.

---

### `POST /api/image`
Downloads a Sentinel-2 true-colour optical image tile for the requested coordinate bounding box, saves the PNG file to disk under `backend/images/`, and records metadata in MongoDB.

- **Method**: `POST`
- **Content-Type**: `application/json`
- **Request Body** (`ImageRequest`):
```json
{
  "latitude": 17.3850,
  "longitude": 78.4867,
  "date_from": "2024-01-01",
  "date_to": "2024-06-30",
  "resolution": 60,
  "bbox_size": 0.05,
  "event_type": "satellite"
}
```
- **Validation Rules**:
  * `latitude`: `-90.0` to `90.0`
  * `longitude`: `-180.0` to `180.0`
  * `date_from`, `date_to`: Format `YYYY-MM-DD`
  * `date_from <= date_to`
  * Acquisition window: Max 365 days (`date_to - date_from <= 365 days`)
  * Future dates: Rejected (`date_to <= today`)
  * `resolution`: `10` to `1000` metres/pixel
  * `bbox_size`: `0.01` to `5.0` degrees
- **Response**: `ApiResponse[ImageData]`

---

### `GET /api/latest-image`
Returns metadata and URL for the most recently saved satellite image tile.

- **Method**: `GET`
- **Response**: `ApiResponse[ImageData]`

---

### `GET /api/gallery`
Returns metadata records for all stored satellite images in `backend/images/`, sorted newest first.

- **Method**: `GET`
- **Response**: `ApiResponse[GalleryData]`

---

### `GET /api/history`
Returns image download history with optional filtering.

- **Method**: `GET`
- **Query Parameters**:
  * `disaster_type` (string, optional): Filter by label (`Wildfire`, `Severe Storm`, `Satellite Capture`).
  * `limit` (integer, default `100`, `1..1000`): Maximum entries to return.
- **Response**: `ApiResponse[GalleryData]`

---

### `GET /api/monitor`
Full monitoring workflow: fetches active disaster events concurrently, extracts valid coordinates, and captures Sentinel-2 imagery for candidate events.

- **Method**: `GET`
- **Query Parameters**:
  * `days` (integer, optional, `1..90`): Time horizon in days.
  * `max_images` (integer, default `5`, `1..20`): Maximum satellite imagery downloads.
- **Response**: `ApiResponse[MonitorData]`
- **Persistence**: Results are logged in the `monitoring_sessions` collection.

---

### `GET /api/analysis/status`
Reports implementation status of the image analysis pipeline components (validation, preprocessing, NDVI, NBR, model inference, and detection results).

- **Method**: `GET`
- **Response**: `ApiResponse[dict]`
- **Example Response**:
```json
{
  "success": true,
  "message": "Analysis pipeline specifications defined; implementation status reported.",
  "data": {
    "pipeline": "Sentinel-2 Earth Intelligence Analysis",
    "status": "pending",
    "stages": {
      "validation": "pending",
      "preprocessing": "pending",
      "spectral_indices": {
        "ndvi": "pending",
        "nbr": "pending"
      },
      "model": "pending",
      "detection_results": "pending"
    },
    "note": "Typed interfaces and mathematical specifications defined. Model training, weights, and inference execution pending milestone."
  },
  "error": null
}
```

---

### `DELETE /api/image/{image_id}`
Permanently deletes a stored image file from `backend/images/`.

- **Method**: `DELETE`
- **Path Parameter**: `image_id` (e.g. `satellite_2026-11-10_12-00_lat17.3850_lon78.4867.png`).
- **Security**: Rejects path traversal (`/`, `\`, `..`) and non-PNG extensions.
- **Response**: `ApiResponse[DeleteData]`

---

## 3. Legacy Endpoints (Deprecated)

These routes are maintained for backward compatibility with older UI components. They are marked `deprecated: true` in the OpenAPI specification and delegate to the unified services without code duplication.

| Legacy Endpoint | Equivalent `/api/*` Endpoint | Notes |
|-----------------|------------------------------|-------|
| `GET /wildfires` | `GET /api/disasters?category=wildfires` | Returns plain array of event objects |
| `GET /storms` | `GET /api/disasters?category=severeStorms` | Returns plain array of event objects |
| `GET /gallery` | `GET /api/gallery` | Returns plain array of image objects |
| `GET /monitor` | `GET /api/monitor` | Returns `{success, wildfires, storms, downloaded, failed}` |
| `GET /satellite` | `GET /api/status` | Returns NASA reachability dict |
| `GET /sentinel-test` | `GET /api/token` | Returns `{authenticated, expires_in, seconds_remaining}` |
| `GET /auth/token` | `GET /api/token` | Returns token summary dict |
| `GET /satellite-image` | `POST /api/image` | Query-param driven image download |

---

## 4. Static Files

Stored images are served at:
```
http://127.0.0.1:8000/images/{filename}
```
Backed by the local directory `backend/images/`.

