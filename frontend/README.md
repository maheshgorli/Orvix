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

1. **Overview Dashboard (`Overview.jsx`)**: Active hazard totals, event distribution, recent acquisitions, latest satellite capture preview.
2. **Live Geospatial Monitoring (`LiveMonitoring.jsx`)**: Full-screen React-Leaflet map with CartoDB Dark Matter tiles, custom vector markers for wildfires and storms, event details popup, and direct "Inspect in Explorer" tasking.
3. **Satellite Explorer (`SatelliteExplorer.jsx`)**:
   - **Step 1 - Search**: Discover STAC scenes via Earth Search by lat/lon, date range, collection, and max cloud cover.
   - **Step 2 - Preview**: Instant thumbnail preview and scene asset inspection.
   - **Step 3 - Acquire**: Download and composite selected scene.
   - **Step 4 - Multi-Product Switcher**: Interactive tabs for True Color RGB, False Color Infrared, NDVI (Vegetation), NDWI (Water), and NBR (Burn Severity).
   - Direct download and "View in Gallery" actions.
4. **Image Gallery (`Gallery.jsx`)**: Grid of all saved satellite scenes, search by filename/coordinates/date, binary download streaming, and safe deletion.
5. **Disaster Intelligence (`DisasterIntelligence.jsx`)**: Full registry of active NASA EONET events with category filtering, search, and JSON export.
6. **Analytics (`Analytics.jsx`)**: Hemispheric distribution, temporal frequency, storage usage, and processing statistics with clear status markers.
7. **System Health & Settings (`Settings.jsx`)**: Live diagnostics for NASA EONET, Earth Search STAC, MongoDB, Local Storage, and Processing Engine.
