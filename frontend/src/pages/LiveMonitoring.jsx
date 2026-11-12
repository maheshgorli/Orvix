import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import styles from "./LiveMonitoring.module.css";
import { Button, Badge, Spinner, ErrorState } from "../components/ui";
import { getDisasters, getMonitor } from "../services/api";

/**
 * Controller sub-component to ensure Leaflet invalidates and resizes correctly
 * when navigating to the Live Monitoring page or resizing the browser viewport.
 */
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    const t1 = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const t2 = setTimeout(() => {
      map.invalidateSize();
    }, 450);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  return null;
}

function formatEventDate(dateStr) {
  if (!dateStr) return "Observed";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toUTCString();
  } catch {
    return dateStr;
  }
}

// Custom vector markers for Wildfire and Severe Storms
const wildfireIcon = L.divIcon({
  className: "orvix-marker",
  html: `<div class="orvix-marker-wildfire" title="Wildfire Event"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const stormIcon = L.divIcon({
  className: "orvix-marker",
  html: `<div class="orvix-marker-storm" title="Severe Storm Event"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 9.54 7H17a6 6 0 0 0-5-3V2z"/><path d="M12 22a10 10 0 0 1-9.54-7H7a6 6 0 0 0 5 3v4z"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

export function LiveMonitoring() {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "wildfires" | "severeStorms"

  // Monitoring acquisition state
  const [acquiring, setAcquiring] = useState(false);
  const [notification, setNotification] = useState(null);

  // Map tile loading & health state
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tileError, setTileError] = useState(false);

  const loadDisasters = useCallback(async () => {
    setError(null);
    try {
      const data = await getDisasters({ days: 30 });
      setEvents(data?.events || []);
    } catch (err) {
      setError(err.message || "Failed to load active disaster telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const data = await getDisasters({ days: 30 });
        if (!ignore) {
          setEvents(data?.events || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load active disaster telemetry.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  // Filter events with real numeric coordinates
  const validEvents = useMemo(() => {
    return events.filter(
      (e) =>
        typeof e.latitude === "number" &&
        typeof e.longitude === "number" &&
        !isNaN(e.latitude) &&
        !isNaN(e.longitude) &&
        e.latitude >= -90 &&
        e.latitude <= 90 &&
        e.longitude >= -180 &&
        e.longitude <= 180
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (filter === "wildfires") {
      return validEvents.filter((e) => e.category_id === "wildfires");
    }
    if (filter === "severeStorms") {
      return validEvents.filter((e) => e.category_id === "severeStorms");
    }
    return validEvents;
  }, [validEvents, filter]);

  const counts = useMemo(() => {
    const wf = validEvents.filter((e) => e.category_id === "wildfires").length;
    const st = validEvents.filter((e) => e.category_id === "severeStorms").length;
    return { all: validEvents.length, wildfires: wf, storms: st };
  }, [validEvents]);

  // Batch acquisition trigger
  async function handleTriggerMonitoring() {
    setAcquiring(true);
    setNotification(null);
    try {
      const result = await getMonitor({ days: 14, max_images: 2 });
      setNotification({
        type: "success",
        message: `Acquisition completed: ${result?.total_events || 0} active events evaluated, ${result?.images_downloaded || 0} satellite scene(s) saved.`,
      });
      await loadDisasters();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Acquisition run encountered an error: ${err.message}`,
      });
    } finally {
      setAcquiring(false);
    }
  }

  function handleOpenExplorer(e) {
    navigate(`/explorer?lat=${e.latitude}&lon=${e.longitude}&type=${e.category_id || "satellite"}`);
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Live Geospatial Monitoring</h1>
          <p className={styles.subtitle}>
            Real-time planetary disaster tracking with synchronized NASA EONET telemetry and Earth Search satellite tasking.
          </p>
        </div>

        <div className={styles.controls}>
          {/* Category Filter Tabs */}
          <div className={styles.filterTabs} role="tablist">
            <button
              role="tab"
              aria-selected={filter === "all"}
              className={`${styles.tab} ${filter === "all" ? styles.tabActive : ""}`}
              onClick={() => setFilter("all")}
            >
              All Events
              <span className={styles.tabCount}>{counts.all}</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === "wildfires"}
              className={`${styles.tab} ${filter === "wildfires" ? styles.tabActive : ""}`}
              onClick={() => setFilter("wildfires")}
            >
              Wildfires
              <span className={styles.tabCount}>{counts.wildfires}</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === "severeStorms"}
              className={`${styles.tab} ${filter === "severeStorms" ? styles.tabActive : ""}`}
              onClick={() => setFilter("severeStorms")}
            >
              Severe Storms
              <span className={styles.tabCount}>{counts.storms}</span>
            </button>
          </div>

          {/* Trigger Monitoring Run */}
          <Button
            variant="primary"
            onClick={handleTriggerMonitoring}
            loading={acquiring}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Trigger Acquisition Run
          </Button>
        </div>
      </div>

      {/* Progress & Notification Banners */}
      {acquiring && (
        <div className={styles.progressBanner}>
          <div className={styles.progressInfo}>
            <Spinner size="sm" />
            <span>Connecting to Earth Search STAC catalogue &amp; downloading satellite imagery…</span>
          </div>
          <Badge variant="cyan">In Progress</Badge>
        </div>
      )}

      {notification && (
        <div
          className={`${styles.notifyAlert} ${
            notification.type === "success"
              ? styles.notifyAlertSuccess
              : styles.notifyAlertError
          }`}
        >
          <span>{notification.message}</span>
          <button
            className={styles.notifyClose}
            onClick={() => setNotification(null)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Map Surface */}
      <div className={styles.mapCard}>
        {/* Overlay Legend & Tile Status */}
        <div className={styles.mapOverlayBar}>
          <div className={styles.legendItem}>
            <span className={styles.legendDotWildfire} />
            <span>Active Wildfire ({counts.wildfires})</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDotStorm} />
            <span>Severe Storm ({counts.storms})</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.tileStatusPill}>
              <span
                className={`${styles.tileStatusDot} ${
                  tileError
                    ? styles.tileStatusDotError
                    : tilesLoading
                    ? styles.tileStatusDotLoading
                    : ""
                }`}
              />
              <span className="mono">
                {tileError
                  ? "OSM (Degraded)"
                  : tilesLoading
                  ? "OSM (Loading…)"
                  : "OpenStreetMap Standard"}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div style={{ padding: "40px" }}>
            <ErrorState title="Geospatial Telemetry Unavailable" message={error} onRetry={loadDisasters} />
          </div>
        ) : (
          <MapContainer
            center={[20, 0]}
            zoom={2.5}
            minZoom={2}
            maxZoom={19}
            className={styles.mapContainer}
            scrollWheelZoom={true}
          >
            <MapResizer />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              subdomains={["a", "b", "c"]}
              eventHandlers={{
                loading: () => setTilesLoading(true),
                load: () => {
                  setTilesLoading(false);
                  setTileError(false);
                },
                tileerror: (err) => {
                  console.warn("Map tile failed to load:", err);
                  setTilesLoading(false);
                  setTileError(true);
                },
              }}
            />

            {filteredEvents.map((evt) => {
              const isWildfire = evt.category_id === "wildfires";
              const icon = isWildfire ? wildfireIcon : stormIcon;

              return (
                <Marker
                  key={evt.event_id || `${evt.latitude}-${evt.longitude}`}
                  position={[evt.latitude, evt.longitude]}
                  icon={icon}
                >
                  <Popup>
                    <div className={styles.popupContent}>
                      <div className={styles.popupHeader}>
                        <Badge variant={isWildfire ? "amber" : "cyan"}>
                          {isWildfire ? "Wildfire" : "Severe Storm"}
                        </Badge>
                        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                          {evt.event_id}
                        </span>
                      </div>

                      <div className={styles.popupTitle}>{evt.title}</div>

                      <div className={styles.popupMetaGrid}>
                        <div className={styles.popupMetaRow}>
                          <span className={styles.popupMetaLabel}>Category</span>
                          <span className={styles.popupMetaVal}>
                            {evt.category || (isWildfire ? "Wildfires" : "Severe Storms")}
                          </span>
                        </div>
                        <div className={styles.popupMetaRow}>
                          <span className={styles.popupMetaLabel}>Event Date</span>
                          <span className={styles.popupMetaVal}>
                            {formatEventDate(evt.date)}
                          </span>
                        </div>
                        <div className={styles.popupMetaRow}>
                          <span className={styles.popupMetaLabel}>Coordinates</span>
                          <span className={`${styles.popupMetaVal} mono`}>
                            {evt.latitude.toFixed(4)}°, {evt.longitude.toFixed(4)}°
                          </span>
                        </div>
                        <div className={styles.popupMetaRow}>
                          <span className={styles.popupMetaLabel}>Source</span>
                          <span className={styles.popupMetaVal}>NASA EONET v3</span>
                        </div>
                      </div>

                      {evt.source_url && (
                        <a
                          href={evt.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.popupLink}
                          title="Open official event report on NASA EONET"
                        >
                          <span>NASA EONET Source Dossier</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </a>
                      )}

                      <div className={styles.popupActions}>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenExplorer(evt)}
                          title="Task Earth Search satellite acquisition at these coordinates"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                          </svg>
                          Task Satellite Explorer
                        </Button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
export default LiveMonitoring;

