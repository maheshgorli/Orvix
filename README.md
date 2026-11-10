# ORVIX — Earth Intelligence Systems

> **Understand Earth. Predict Tomorrow.**

ORVIX is an automated Earth Intelligence platform that correlates NASA EONET natural disaster telemetry with European Space Agency (ESA) Copernicus Data Space Ecosystem (CDSE) Sentinel-2 optical imagery. It provides real-time geospatial hazard tracking, on-demand satellite tasking, and a persistent local imagery archive.

---

## 1. System Architecture

```mermaid
flowchart LR
    subgraph Data Sources
        NASA[NASA EONET v3 API]
        CDSE[Copernicus Data Space Ecosystem]
    end

    subgraph Backend [FastAPI Backend :8000]
        API[/api/* Unified Router]
        NS[NasaService]
        SS[SentinelService & TokenService]
        IS[ImageService]
        DB[(MongoDB / Fallback)]
        FS[(Disk: backend/images/)]
    end

    subgraph Frontend [React 19 + Leaflet :5173]
        LM[Live Geospatial Map]
        SE[Satellite Explorer]
        IG[Image Gallery]
        DI[Disaster Intelligence]
        AN[Planetary Analytics]
        ST[System Health]
    end

    NASA -->|Async concurrent events| NS
    CDSE -->|OAuth2 & Process API L2A| SS
    NS --> API
    SS --> IS
    IS --> FS
    IS --> DB
    API --> Frontend
```

---

## 2. Core Capabilities

1. **Live Geospatial Monitoring**: Interactive map powered by React-Leaflet and CartoDB Dark Matter tiles plotting active wildfires and severe storms using distinctive custom vector markers (no emojis).
2. **Sentinel-2 Satellite Tasking**: Parameterized coordinate acquisition (`lat`, `lon`, date range, spatial resolution) via the Copernicus Data Space Ecosystem.
3. **Local Satellite Archive**: High-resolution imagery stored deterministically on disk (`backend/images/`) with instant previews, file downloads, search/filtering, and permanent deletion. **No fake AI scores.**
4. **Disaster Intelligence Directory**: Comprehensive EONET disaster registry with category filtering, search, direct NASA dossier references, and JSON export.
5. **System Health & Subsystem Diagnostics**: Real-time status reporting for NASA EONET, Copernicus OAuth token lifecycle, and MongoDB database connectivity without exposing secret credentials.
6. **Planetary Analytics**: Spatial hemispheric distribution (North/South, East/West), temporal recency metrics (7/14/30 days), and transparent labeling of uncomputed analytical indices as `not available`.

---

## 3. Quick Start (Windows)

### Option A: Using the Windows Batch Launcher
```bat
start_backend.bat
```

### Option B: Running from Terminal

#### 1. Backend (Terminal 1)
```powershell
uv run --directory backend uvicorn app.main:app --port 8000 --reload
```
*API Documentation:* Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in your browser.

#### 2. Frontend (Terminal 2)
```powershell
cd frontend
npm install
npm run dev
```
*Mission Control:* Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

---

## 4. Environment Configuration

Copy `.env.example` to `backend/.env`:
```powershell
copy .env.example backend\.env
```

| Key | Purpose | Default |
| :--- | :--- | :--- |
| `NASA_API_KEY` | NASA Open API key | `DEMO_KEY` |
| `SENTINEL_CLIENT_ID` | Copernicus CDSE OAuth client ID | Required for satellite tasking |
| `SENTINEL_CLIENT_SECRET`| Copernicus CDSE OAuth client secret | Required for satellite tasking |
| `MONGODB_URI` | MongoDB Connection URI (Optional) | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | Database collection name | `orvix` |

---

## 5. Verification & Testing

- **Backend Validation:**
  ```powershell
  uv run --directory backend python -m compileall app
  ```
- **Frontend Validation:**
  ```powershell
  cd frontend
  npm run lint
  npm run build
  ```

