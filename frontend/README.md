# ORVIX — Frontend Application

The ORVIX frontend is a mission-control web interface built with React, Vite, and React-Leaflet. It provides real-time geospatial disaster tracking, interactive Earth observation satellite tasking (Sentinel-2 L2A & Landsat), multispectral composite inspection, and local image archive management.

---

## 1. Quick Start (Windows)

### Prerequisites
- Node.js 18+
- npm 9+

### Commands
```powershell
cd frontend

# Install dependencies
npm install

# Start development server on port 5173
npm run dev

# Run ESLint validation
npm run lint

# Build production bundle in frontend/dist/
npm run build

# Preview production build on port 5173
npm run preview -- --port 5173
```

---

## 2. Design System & Typography

- **Branding**:
  - Name: **ORVIX**
  - Subtitle: **EARTH INTELLIGENCE SYSTEMS**
  - Tagline: *Understand Earth. Predict Tomorrow.*
- **Palette**:
  - Backgrounds: Dark Navy / Charcoal (`#090c10`, `#0d1117`, `#131922`)
  - Accents: Electric Cyan (`#06b6d4`), Teal (`#14b8a6`), Emerald (`#10b981`)
  - Alerts: Amber (`#f59e0b`) for wildfires, Crimson (`#ef4444`) for storms & errors
- **Iconography**: Embedded vector SVGs only. **Strictly zero emojis.**
- **Coordinates & Metrics**: Monospace typography (`--font-mono`).

---

## 3. Pages & Features

1. **Earth Dashboard (`Overview.jsx`)**: Active hazard totals, event distribution, recent acquisitions, latest satellite capture preview, and quick-action access cards.
2. **Disaster Map (`LiveMonitoring.jsx`)**: Full-screen React-Leaflet map with standard OpenStreetMap raster tiles, custom vector markers for wildfires and storms, event details popup, and direct "Explore Satellite Images" prefilled tasking.
3. **Explore Satellite Images (`SatelliteExplorer.jsx`)**:
   - **Step 1 - Location**: Manual coordinates with validation, landmark presets, or direct incident handoff.
   - **Step 2 - Time Period**: Date range with satellite revisit cycle guidance.
   - **Step 3 - Data Source**: Sentinel-2 L2A vs Landsat-8/9 C2 L2 cards.
   - **Step 4 - Advanced**: Max cloud cover slider, spatial resolution, and classification tag.
   - **Step 5 - Discovery**: Earth Search STAC scene search with instant metadata preview.
   - **Step 6 - Processing**: Direct acquisition with 6-stage visual pipeline tracker.
   - **Step 7 - Multi-Spectral Products**: True Color RGB, False Color Infrared, NDVI (Vegetation), NDWI (Water), and NBR (Burn Severity) with plain-language explanations and full mathematical formulas.
4. **My Satellite Archive (`Gallery.jsx`)**: Grid of all saved satellite scenes, spectral product badges, search by filename/coordinates/date, binary download streaming, and safe deletion.
5. **Disaster Insights (`DisasterIntelligence.jsx`)**: Full registry of active NASA EONET events with educational context, category filtering, search, JSON export, and space tasking.
6. **Earth Analytics (`Analytics.jsx`)**: Hemispheric distribution, temporal frequency, storage usage, and multispectral index status with honest "not available" badges for uncalibrated ML models.
7. **Settings & Data Sources (`Settings.jsx`)**: Live diagnostics for NASA EONET, Earth Search STAC, MongoDB/SQLite, Local Storage, and Processing Engine.
