# ORVIX — Tech Debt & Implementation Status Tracker

This document tracks the implementation status of ORVIX (Earth Intelligence Systems), reconciling the original PRD specifications with the active codebase.

---

## 1. Feature Status Matrix

| Component / Requirement | Status | Implementation Details |
| :--- | :--- | :--- |
| **NASA EONET Telemetry** | **Completed & Tested** | Concurrent async ingestion (`httpx` + `asyncio.gather`) for active wildfires, severe storms, floods, volcanoes via `/api/disasters`. |
| **Satellite Acquisition (Earth Search STAC)** | **Completed & Tested** | Provider-independent STAC acquisition engine (`earth_search.py`) querying Element 84 AWS open data (`sentinel-2-l2a`). Acquires Cloud-Optimized GeoTIFFs (COGs) over public HTTPS without OAuth token failure. |
| **Multispectral Spectral Processing** | **Completed & Tested** | Genuine mathematical computation of **NDVI** `(B08-B04)/(B08+B04)`, **NDWI** `(B03-B08)/(B03+B08)`, **NBR** `(B08-B12)/(B08+B12)`, False Color Infrared `(B08,B04,B03)`, and True Color RGB with 2%-98% percentile contrast stretch. |
| **Local Disk & Satellite Archive** | **Completed & Tested** | Multi-tier file persistence to `backend/images/satellite/`, `thumbnails/`, `processed/`, static mount at `/images/`, and binary file streaming download via `/api/gallery/{id}/download`. |
| **Persistence Layer (MongoDB + Disk)** | **Completed & Tested** | Motor/pymongo layer in `db_service.py` for disaster events, scene acquisitions, metadata, and alerts. Full offline fallback to `backend/data/acquisitions.json` and `alerts.json`. |
| **API Envelope & Single Source of Truth** | **Completed & Tested** | All primary operations consolidated under `/api/*` returning uniform `{ success, message, data, error }`. Endpoints include `/api/imagery/scenes`, `/api/imagery/acquire`, `/api/gallery`, `/api/status`. |
| **Interactive Leaflet Mapping** | **Completed & Tested** | React-Leaflet integration in `LiveMonitoring.jsx` using CartoDB Dark Matter tiles and custom HTML/SVG vector markers for wildfires and storms (zero emojis). Direct "Inspect in Explorer" navigation. |
| **Satellite Explorer & Multi-Product View** | **Completed & Tested** | Two-step workflow: interactive STAC scene discovery (cloud cover filter, date range, collection) -> scene selection -> genuine satellite acquisition -> multi-product viewer (True Color, False Color, NDVI, NDWI, NBR) -> Gallery link. |
| **Archive Gallery** | **Completed & Tested** | Full gallery with real metadata, image previews, direct downloads, search/filtering, and safe file/record deletion. **No fake AI scores.** |
| **System Diagnostics & Health** | **Completed & Tested** | Real-time concurrent health check across NASA EONET, Earth Search STAC, MongoDB, Local Storage Engine, and Image Processing Engine (zero exposed secrets). |
| **Trained ML Segmentation Weights** | **Pending Future Milestone** | Computer vision morphology and threshold anomaly detectors are operational. Neural network damage segmentation (U-Net/ResNet) will be trained with domain-specific datasets in future milestones. |

---

## 2. Reconciled Dependencies

All dependencies in `pyproject.toml` and `package.json` are actively wired and utilized:

- **`rasterio`**: Cloud-Optimized GeoTIFF (COG) reading via GDAL range requests, spatial bounding box windowing, and overviews.
- **`matplotlib`**: Applied colormaps (`RdYlGn` for NDVI, `Blues` for NDWI, `hot` for NBR) in scalar index heatmaps.
- **`pillow` (PIL)**: Array normalization, PNG encoding, JPEG thumbnail processing.
- **`opencv-python` (`cv2`)**: Morphological operations, spatial variance, and edge-contour extraction in `detection_service.py`.
- **`numpy`**: Multispectral array algebra, percentile contrast stretching (2%-98%), and band stacking.
- **`httpx`**: Asynchronous HTTP client for concurrent Earth Search STAC queries, AWS S3 downloads, and NASA EONET ingestion.
- **`motor` / `pymongo`**: Async MongoDB connection pooling, indexing, and persistence.
- **`fastapi`**: ASGI backend framework serving REST endpoints and static file mounts.

---

## 3. Remaining Work & Future Milestones

1. **Model Weight Integration**:
   - Train and bundle an inference model (e.g. lightweight ONNX or PyTorch model) inside `backend/app/services/analysis/model.py` for automated building damage segmentation.
2. **Automated Cron Scheduling**:
   - Introduce background scheduler workers for automated recurring 6-hour planetary scans over disaster-prone coordinates.
