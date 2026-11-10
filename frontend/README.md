# ORVIX — Frontend Application

The ORVIX frontend is a mission-control web interface built with React 19, Vite, and React-Leaflet. It provides real-time geospatial disaster tracking, interactive satellite tasking, and local image archive management.

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

## 3. Component Architecture

```text
frontend/src/
├── index.css                   # Global design tokens, reset, Leaflet dark overrides
├── main.jsx                    # Application entrypoint
├── App.jsx                     # Router config for all 7 routes
├── services/
│   └── api.js                  # Central Axios client unwrapping { success, message, data, error }
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx       # App shell wrapping sidebar and main viewport
│   │   └── Sidebar.jsx         # Collapsible sidebar with brand identity and live clock
│   └── ui/
│       ├── Button.jsx          # Primary, secondary, outline, danger variants with spinner
│       ├── Badge.jsx           # Cyan, amber, emerald, danger status indicators
│       ├── Card.jsx            # Surface card layout primitives
│       ├── Spinner.jsx         # Circular radar SVG loader
│       ├── EmptyState.jsx      # Empty list placeholder with call-to-action
│       └── ErrorState.jsx      # Error banner with retry trigger
└── pages/
    ├── Overview.jsx            # Planetary metrics, active feed, latest acquisition
    ├── LiveMonitoring.jsx      # React-Leaflet map with custom vector markers
    ├── SatelliteExplorer.jsx   # Interactive Sentinel-2 tasking & metadata inspector
    ├── Gallery.jsx             # Local imagery archive with download & delete
    ├── DisasterIntelligence.jsx# NASA EONET incident registry with JSON export
    ├── Analytics.jsx           # Spatial/temporal analytics & pending metrics
    └── Settings.jsx            # Subsystem health diagnostics (NASA, CDSE, MongoDB)
```
