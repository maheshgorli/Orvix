# ORVIX — Tech Debt & Implementation Status Tracker

This document tracks the implementation status of ORVIX (Earth Intelligence Systems), reconciling the original PRD specifications with the active codebase.

---

## 1. Feature Status Matrix

| Component / Requirement | Status | Implementation Details |
| :--- | :--- | :--- |
| **NASA EONET Telemetry** | **Completed & Tested** | Concurrent async ingestion (`httpx` + `asyncio.gather`) for active wildfires and severe storms via `/api/disasters`. |
| **Copernicus CDSE OAuth & Tasking** | **Completed & Tested** | Token refresh cache against Copernicus Data Space Ecosystem (`identity.dataspace.copernicus.eu`), payload builder, and Sentinel-2 L2A true-colour acquisition via `/api/image`. |
| **Local Disk Imagery Archive** | **Completed & Tested** | File persistence to `backend/images/` with deterministic naming (`{type}_{date}_{time}_lat{lat}_lon{lon}.png`), static mount at `/images/`, and deletion via `/api/image/{id}`. |
| **Persistence Layer (MongoDB)** | **Completed & Tested** | Motor/pymongo layer in `db_service.py` for disaster events (deduplicated by `event_id`), image metadata, acquisition logs, and monitoring sessions. Graceful fallback to memory/disk when `MONGODB_URI` is unconfigured. |
| **API Envelope & Single Source of Truth** | **Completed & Tested** | All primary operations consolidated under `/api/*` returning uniform `{ success, message, data, error }`. Legacy prototype routes kept as deprecated thin wrappers. |
| **Interactive Leaflet Mapping** | **Completed & Tested** | React-Leaflet integration in `LiveMonitoring.jsx` using CartoDB Dark Matter tiles and custom HTML/SVG vector markers for wildfires and storms (zero emojis). |
| **Mission Control Design System** | **Completed & Tested** | Dark navy/charcoal tokens (`#090c10`), cyan/teal accents, responsive collapsible sidebar with live UTC clock, and reusable UI kit (`Card`, `Button`, `Badge`, `Spinner`, `EmptyState`, `ErrorState`). |
| **Satellite Explorer & Tasking** | **Completed & Tested** | Parameterized form for latitude, longitude, date range, resolution, and bounding box with active incident presets. |
| **Archive Gallery** | **Completed & Tested** | Full gallery with real metadata, image previews, direct downloads, search/filtering, and deletion. **No fake AI scores.** |
| **Spectral & ML Analysis Pipeline Skeleton** | **Implemented (Typed Interfaces)** | Typed contracts in `backend/app/services/analysis/` (`validator`, `preprocessor`, `spectral`, `model`). Execution stages honestly raise `NotImplementedError` and report `pending` via `/api/analysis/status`. |
| **Live Spectral Computations (NDVI/NBR)** | **Pending Milestone** | Requires upgrading ingestion pipeline to multi-band 13-band Sentinel-2 granules (currently fetching 3-band true-colour PNGs). |
| **Trained ML Detection & Segmentation** | **Pending Milestone** | Requires trained model weights (U-Net/ResNet) and inference runtime. No synthetic scores are returned. |

---

## 2. Reconciled Dependencies

In earlier drafts of this document, dependencies were labeled as unused. The current reality:

- **`pillow` (PIL)**: **Actively used** in `backend/app/services/image_service.py` for image decoding, array serialization, and PNG persistence.
- **`motor` / `pymongo`**: **Actively wired** in `backend/app/services/db_service.py` for MongoDB connection pooling and async persistence.
- **`httpx`**: **Actively used** for concurrent HTTP requests to NASA EONET and Copernicus Data Space.
- **`numpy`**: **Actively used** for image array manipulation and spectral buffer typing.
- **`tensorflow` / `opencv-python` / `scikit-learn`**: Reserved for the upcoming model training and segmentation milestone. They are kept as intent markers and isolated from runtime imports so core platform operations remain lightweight.

---

## 3. Remaining Work & Future Milestones

1. **Multispectral Granule Ingestion**:
   - Extend `sentinel_service.py` to optionally request multi-band GeoTIFF outputs (specifically B04, B08, and B12) to compute mathematical NDVI `(B08 - B04)/(B08 + B04)` and NBR `(B08 - B12)/(B08 + B12)`.
2. **Model Weight Integration**:
   - Train and bundle an inference model (e.g. lightweight ONNX or PyTorch model) inside `backend/app/services/analysis/model.py` to replace the `NotImplementedError` skeleton with true damage segmentation masks.
3. **Automated Cron Scheduling**:
   - Introduce Celery or FastAPI background worker crons for recurring 6-hour planetary scans.
