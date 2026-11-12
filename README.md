# ORVIX — Earth Intelligence Systems

> **Understand Earth. Predict Tomorrow.**

ORVIX is an automated Earth Intelligence and geospatial monitoring platform that correlates real-time natural disaster telemetry from NASA EONET with open Earth observation satellite data (Sentinel-2 L2A & Landsat) via Earth Search STAC. It provides planetary hazard tracking, satellite scene discovery, multispectral raster processing (True Color, False Color, NDVI, NDWI, NBR), and a persistent local imagery archive.

---

## 1. System Architecture

```mermaid
flowchart LR
    subgraph Data Sources
        NASA[NASA EONET v3 API]
        STAC[Earth Search STAC / AWS Open Data]
    end

    subgraph Backend [FastAPI Backend :8000]
        API[/api/* Unified Router]
        ES[EarthSearchService]
        NS[NasaService]
        IS[ImageService]
        PS[ProcessingService]
        DB[(MongoDB / Local JSON Store)]
        FS[(Disk: backend/images/)]
    end

    subgraph Frontend [React + Leaflet :5173]
        OV[Earth Dashboard]
        LM[Disaster Map]
        SE[Explore Satellite Images]
        IG[My Satellite Archive]
        DI[Disaster Insights]
        AN[Earth Analytics]
        ST[Settings & Data Sources]
    end

    NASA -->|Async concurrent events| NS
    STAC -->|Public COGs over HTTPS| ES
    NS --> API
    ES --> PS
    PS --> IS
    IS --> FS
    IS --> DB
    API --> Frontend
```

---

## 2. Core Capabilities

1. **Disaster Map (Live Geospatial Monitoring)**: Interactive map powered by React-Leaflet and OpenStreetMap standard raster tiles plotting active wildfires and severe storms using distinctive custom vector markers (no emojis, no API keys required).
2. **Provider-Independent Satellite Tasking**: Parameterized coordinate acquisition (`lat`, `lon`, date range, max cloud cover %) via Earth Search STAC accessing public Cloud-Optimized GeoTIFFs (COGs) on AWS Open Data without broken OAuth dependencies.
3. **Multispectral Image Processing Engine**:
   - **True Color (RGB)**: Sentinel-2 B04 (Red), B03 (Green), B02 (Blue) with 2%-98% percentile contrast stretch.
   - **False Color Infrared**: B08 (NIR), B04 (Red), B03 (Green) for burn scar and vegetation delineation.
   - **NDVI (Normalized Difference Vegetation Index)**: $(NIR - Red) / (NIR + Red)$ with RdYlGn colormap.
   - **NDWI (Normalized Difference Water Index)**: $(Green - NIR) / (Green + NIR)$ with Blues colormap.
   - **NBR (Normalized Burn Ratio)**: $(NIR - SWIR2) / (NIR + SWIR2)$ with thermal colormap.
4. **Local Satellite Archive & Gallery**: Acquired imagery stored deterministically on disk (`backend/images/satellite/`, `thumbnails/`, `processed/`) with instant previews, binary file downloads, search/filtering, and safe permanent deletion.
5. **Disaster Intelligence Directory**: Comprehensive NASA EONET disaster registry with category filtering, search, direct NASA dossier references, and JSON export.
6. **System Health & Subsystem Diagnostics**: Real-time status reporting for NASA EONET, Earth Search STAC, MongoDB database, Local Storage Engine, and Processing Engine without exposing secrets.
7. **Planetary Analytics**: Spatial hemispheric distribution (North/South, East/West), temporal recency metrics (7/14/30 days), and transparent labeling of uncomputed analytical indices.

---

## 3. Quick Start (Windows)

### 1. Start Backend (Terminal 1)
```powershell
uv run uvicorn backend.app.main:app --port 8000 --reload
```
*API Documentation & Swagger UI:* [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Start Frontend (Terminal 2)
```powershell
cd frontend
npm install
npm run dev
```
*Mission Control Web App:* [http://localhost:5173](http://localhost:5173)

---

## 4. Environment Configuration

Copy `.env.example` to `backend/.env`:
```powershell
copy .env.example backend\.env
```

| Key | Purpose | Default |
| :--- | :--- | :--- |
| `NASA_API_KEY` | NASA Open API key | `DEMO_KEY` (Free at https://api.nasa.gov/) |
| `MONGODB_URI` | MongoDB Connection URI (Optional) | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | Database collection name | `orvix` |

> [!NOTE]
> Satellite data acquisition via Earth Search STAC is 100% free and public; no API key or OAuth credentials are required. If `MONGODB_URI` is unconfigured, ORVIX continues running with zero downtime using local JSON persistence (`backend/data/acquisitions.json`).

---

## 5. Automated Verification & Testing

Run the full end-to-end integration test suite:
```powershell
uv run python scripts/test_full_platform.py
```

Run frontend linting and build checks:
```powershell
cd frontend
npm run lint
npm run build
```
