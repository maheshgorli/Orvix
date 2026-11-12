import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import styles from "./SatelliteExplorer.module.css";
import { Button, Badge, Spinner, EmptyState, ErrorState } from "../components/ui";
import {
  searchSatelliteScenes,
  acquireSatelliteScene,
  getDisasters,
  getDownloadUrl,
} from "../services/api";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getDefaultDates() {
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 90);
  return {
    from: past.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export function SatelliteExplorer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const defaultDates = getDefaultDates();

  // Search Parameters
  const [latitude, setLatitude] = useState(
    searchParams.get("lat") ? parseFloat(searchParams.get("lat")) : 44.3187
  );
  const [longitude, setLongitude] = useState(
    searchParams.get("lon") ? parseFloat(searchParams.get("lon")) : -106.9325
  );
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [collection, setCollection] = useState("sentinel-2-l2a");
  const [maxCloud, setMaxCloud] = useState(30);
  const [resolution, setResolution] = useState(10);
  const [eventType, setEventType] = useState(searchParams.get("type") || "satellite");

  // Presets from NASA EONET
  const [disasterPresets, setDisasterPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState("");

  // Scene Discovery State
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Acquisition State
  const [acquireLoading, setAcquireLoading] = useState(false);
  const [acquireError, setAcquireError] = useState(null);
  const [acquiredResult, setAcquiredResult] = useState(null);

  // Active Multi-Product Layer: 'true_color' | 'false_color' | 'ndvi' | 'ndwi' | 'nbr'
  const [activeProduct, setActiveProduct] = useState("true_color");

  // Load NASA active disaster presets
  useEffect(() => {
    let ignore = false;
    async function loadPresets() {
      try {
        const res = await getDisasters({ days: 30 });
        if (!ignore && res?.events) {
          const valid = res.events.filter(
            (e) => typeof e.latitude === "number" && typeof e.longitude === "number"
          );
          setDisasterPresets(valid.slice(0, 15));
        }
      } catch {
        // Non-critical
      }
    }
    loadPresets();
    return () => {
      ignore = true;
    };
  }, []);

  // Synchronize state when URL query params change
  const [prevParamsString, setPrevParamsString] = useState(() => searchParams.toString());
  const currentParamsString = searchParams.toString();
  if (currentParamsString !== prevParamsString) {
    setPrevParamsString(currentParamsString);
    const pLat = searchParams.get("lat");
    const pLon = searchParams.get("lon");
    const pType = searchParams.get("type");
    if (pLat && !isNaN(parseFloat(pLat))) setLatitude(parseFloat(pLat));
    if (pLon && !isNaN(parseFloat(pLon))) setLongitude(parseFloat(pLon));
    if (pType) setEventType(pType);
  }

  function handlePresetChange(e) {
    const id = e.target.value;
    setSelectedPreset(id);
    const found = disasterPresets.find((item) => item.event_id === id);
    if (found) {
      setLatitude(found.latitude);
      setLongitude(found.longitude);
      setEventType(found.category_id === "wildfires" ? "wildfire" : "storm");
    }
  }

  // Client-side validation
  function validateParams() {
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return "Latitude must be a valid number between -90.0 and +90.0 degrees.";
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return "Longitude must be a valid number between -180.0 and +180.0 degrees.";
    }
    if (!dateFrom || !dateTo) {
      return "Both start date and end date must be specified.";
    }
    if (dateFrom > dateTo) {
      return "Start date must be before or equal to end date.";
    }
    const today = new Date().toISOString().slice(0, 10);
    if (dateTo > today) {
      return `End date (${dateTo}) cannot be in the future (today is ${today}).`;
    }
    return null;
  }

  const validationError = validateParams();

  // 1. Search Scenes in Earth Search STAC
  async function handleSearchScenes() {
    if (validationError) return;
    setSearchLoading(true);
    setSearchError(null);
    setSelectedScene(null);

    try {
      const data = await searchSatelliteScenes({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        date_from: dateFrom,
        date_to: dateTo,
        collection,
        max_cloud: parseFloat(maxCloud),
        limit: 8,
      });
      const found = data?.scenes || [];
      setScenes(found);
      if (found.length > 0) {
        setSelectedScene(found[0]);
      } else {
        setSearchError("No scenes found matching criteria. Try increasing max cloud cover or widening date range.");
      }
    } catch (err) {
      setSearchError(err.message || "Failed to search satellite catalogue.");
    } finally {
      setSearchLoading(false);
    }
  }

  // 2. Acquire Selected or Best Scene
  async function handleAcquire(targetSceneId = null) {
    if (validationError) return;
    const sceneToAcquire = targetSceneId || selectedScene?.scene_id;
    setAcquireLoading(true);
    setAcquireError(null);

    try {
      const data = await acquireSatelliteScene({
        scene_id: sceneToAcquire || undefined,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        date_from: dateFrom,
        date_to: dateTo,
        collection,
        max_cloud: parseFloat(maxCloud),
        resolution: parseInt(resolution, 10),
        event_type: eventType,
      });
      setAcquiredResult(data);
      setActiveProduct("true_color");
    } catch (err) {
      setAcquireError(err.message || "Satellite acquisition request failed.");
    } finally {
      setAcquireLoading(false);
    }
  }

  // Get active display image URL
  function getCurrentImageUrl() {
    if (!acquiredResult) return "";
    if (activeProduct === "false_color" && acquiredResult.indices?.false_color) {
      return acquiredResult.indices.false_color;
    }
    if (activeProduct === "ndvi" && acquiredResult.indices?.ndvi) {
      return acquiredResult.indices.ndvi;
    }
    if (activeProduct === "ndwi" && acquiredResult.indices?.ndwi) {
      return acquiredResult.indices.ndwi;
    }
    if (activeProduct === "nbr" && acquiredResult.indices?.nbr) {
      return acquiredResult.indices.nbr;
    }
    return acquiredResult.image_url;
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Satellite Explorer &amp; Tasking</h1>
        <p className={styles.subtitle}>
          Provider-independent Earth observation via Earth Search STAC (Sentinel-2 L2A &amp; Landsat).
        </p>
      </div>

      <div className={styles.layout}>
        {/* Left Parameters & Scene Discovery Card */}
        <div className={styles.formCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>Tasking Parameters</h2>
            <Badge variant="cyan">{collection === "sentinel-2-l2a" ? "Sentinel-2 L2A" : "Landsat C2 L2"}</Badge>
          </div>

          {/* Preset Selector */}
          {disasterPresets.length > 0 && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span>Target from Active Disaster</span>
                <span className={styles.labelHint}>NASA EONET</span>
              </label>
              <select
                className={styles.presetSelect}
                value={selectedPreset}
                onChange={handlePresetChange}
              >
                <option value="">Select active event preset…</option>
                {disasterPresets.map((evt) => (
                  <option key={evt.event_id} value={evt.event_id}>
                    [{evt.category_id === "wildfires" ? "FIRE" : "STORM"}] {evt.title.slice(0, 34)}…
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Coordinates */}
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span>Latitude</span>
                <span className={styles.labelHint}>-90..90</span>
              </label>
              <input
                type="number"
                step="0.0001"
                className={`${styles.input} ${styles.inputMono}`}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span>Longitude</span>
                <span className={styles.labelHint}>-180..180</span>
              </label>
              <input
                type="number"
                step="0.0001"
                className={`${styles.input} ${styles.inputMono}`}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          {/* Date Range */}
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Start Date</label>
              <input
                type="date"
                className={styles.input}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>End Date</label>
              <input
                type="date"
                className={styles.input}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Satellite Source & Cloud Filter */}
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Satellite Source</label>
              <select
                className={styles.select}
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
              >
                <option value="sentinel-2-l2a">Sentinel-2 L2A (Multispectral)</option>
                <option value="landsat-c2-l2">Landsat-8/9 C2 L2</option>
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span>Max Cloud Cover</span>
                <span className={styles.labelHint}>{maxCloud}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={maxCloud}
                onChange={(e) => setMaxCloud(e.target.value)}
                style={{ accentColor: "var(--accent-cyan)", marginTop: "6px" }}
              />
            </div>
          </div>

          {/* Classification & Resolution */}
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Optical Resolution</label>
              <select
                className={styles.select}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value={10}>10m (Native optical)</option>
                <option value={20}>20m (Multispectral)</option>
                <option value={60}>60m (Regional preview)</option>
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Classification Tag</label>
              <select
                className={styles.select}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="satellite">Satellite Capture</option>
                <option value="wildfire">Wildfire Area</option>
                <option value="storm">Storm System</option>
              </select>
            </div>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className={styles.validationAlert}>{validationError}</div>
          )}

          {/* Dual Action Buttons: Search Catalogue vs Direct Acquire */}
          <div className={styles.buttonRow}>
            <Button
              variant="outline"
              onClick={handleSearchScenes}
              loading={searchLoading}
              disabled={Boolean(validationError) || searchLoading || acquireLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search Scenes
            </Button>
            <Button
              variant="primary"
              onClick={() => handleAcquire(selectedScene?.scene_id)}
              loading={acquireLoading}
              disabled={Boolean(validationError) || acquireLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {selectedScene ? "Acquire Scene" : "Acquire Best"}
            </Button>
          </div>

          {/* Discovered Scenes List */}
          {scenes.length > 0 && (
            <div className={styles.fieldGroup} style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className={styles.label}>Discovered Scenes ({scenes.length})</label>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Select to acquire</span>
              </div>
              <div className={styles.sceneList}>
                {scenes.map((sc) => {
                  const isSelected = selectedScene?.scene_id === sc.scene_id;
                  return (
                    <div
                      key={sc.scene_id}
                      className={`${styles.sceneCard} ${isSelected ? styles.sceneCardSelected : ""}`}
                      onClick={() => setSelectedScene(sc)}
                    >
                      {sc.thumbnail_url ? (
                        <img src={sc.thumbnail_url} alt={sc.scene_id} className={styles.sceneThumb} />
                      ) : (
                        <div className={styles.sceneThumb} style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: "0.65rem" }}>
                          GEO
                        </div>
                      )}
                      <div className={styles.sceneInfo}>
                        <div className={styles.sceneId}>{sc.scene_id}</div>
                        <div className={styles.sceneMetaRow}>
                          <span>{sc.date}</span>
                          <span>•</span>
                          <span style={{ color: sc.cloud_cover < 10 ? "var(--accent-green)" : sc.cloud_cover < 30 ? "var(--accent-yellow)" : "var(--accent-red)" }}>
                            ☁ {sc.cloud_cover}%
                          </span>
                          <span>•</span>
                          <span>{sc.available_bands?.length || 0} bands</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {searchError && (
            <div className={styles.validationAlert} style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "var(--accent-red)" }}>
              {searchError}
            </div>
          )}
        </div>

        {/* Right Output View */}
        <div className={styles.previewContainer}>
          {acquireLoading ? (
            <div className={styles.viewerCard}>
              <div className={styles.viewerBody} style={{ flexDirection: "column", gap: "16px" }}>
                <Spinner size="lg" />
                <div style={{ color: "var(--text-main)", fontSize: "0.95rem", fontWeight: 600 }}>
                  Acquiring Genuine Satellite Imagery…
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", maxWidth: "420px", textAlign: "center" }}>
                  Downloading Cloud-Optimized GeoTIFFs from AWS Open Data, compositing True Color RGB, and computing NDVI/NDWI/NBR indices…
                </div>
              </div>
            </div>
          ) : acquireError ? (
            <ErrorState
              title="Satellite Acquisition Failed"
              message={acquireError}
              onRetry={() => handleAcquire(selectedScene?.scene_id)}
            />
          ) : acquiredResult ? (
            <div className={styles.viewerCard}>
              {/* Product Tabs Header */}
              <div className={styles.viewerHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Badge variant="emerald">Acquisition Verified</Badge>
                  <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {acquiredResult.scene_id || acquiredResult.filename}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getDownloadUrl(acquiredResult.filename), "_blank")}
                  >
                    Download Raster
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate("/gallery")}
                  >
                    View in Gallery
                  </Button>
                </div>
              </div>

              {/* Spectral Products Switcher */}
              <div className={styles.productTabs}>
                <button
                  className={`${styles.productTab} ${activeProduct === "true_color" ? styles.productTabActive : ""}`}
                  onClick={() => setActiveProduct("true_color")}
                >
                  True Color (RGB)
                </button>
                {acquiredResult.indices?.false_color && (
                  <button
                    className={`${styles.productTab} ${activeProduct === "false_color" ? styles.productTabActive : ""}`}
                    onClick={() => setActiveProduct("false_color")}
                  >
                    False Color (Infrared)
                  </button>
                )}
                {acquiredResult.indices?.ndvi && (
                  <button
                    className={`${styles.productTab} ${activeProduct === "ndvi" ? styles.productTabActive : ""}`}
                    onClick={() => setActiveProduct("ndvi")}
                  >
                    NDVI (Vegetation)
                  </button>
                )}
                {acquiredResult.indices?.ndwi && (
                  <button
                    className={`${styles.productTab} ${activeProduct === "ndwi" ? styles.productTabActive : ""}`}
                    onClick={() => setActiveProduct("ndwi")}
                  >
                    NDWI (Water)
                  </button>
                )}
                {acquiredResult.indices?.nbr && (
                  <button
                    className={`${styles.productTab} ${activeProduct === "nbr" ? styles.productTabActive : ""}`}
                    onClick={() => setActiveProduct("nbr")}
                  >
                    NBR (Burn Severity)
                  </button>
                )}
              </div>

              {/* Main Image Display */}
              <div className={styles.viewerBody}>
                <img
                  src={getCurrentImageUrl()}
                  alt={acquiredResult.filename}
                  className={styles.acquiredImage}
                />
              </div>

              {/* Metadata Inspector */}
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Target Center</span>
                  <span className={`${styles.metaVal} mono`}>
                    {acquiredResult.latitude?.toFixed(4)}, {acquiredResult.longitude?.toFixed(4)}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Observation Date</span>
                  <span className={styles.metaVal}>{acquiredResult.date}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Cloud Cover</span>
                  <span className={styles.metaVal}>{acquiredResult.cloud_cover}%</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Satellite Platform</span>
                  <span className={styles.metaVal}>{acquiredResult.platform || "Sentinel-2"}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Disk Payload</span>
                  <span className={`${styles.metaVal} mono`}>
                    {formatBytes(acquiredResult.file_size_bytes)}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Data Catalogue</span>
                  <span className={styles.metaVal}>Earth Search STAC (AWS)</span>
                </div>
              </div>

              {/* Persistence Confirmation */}
              <div className={styles.persistedNotice}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Persisted to local storage (<code>backend/{acquiredResult.image_path}</code>) and synced to database.</span>
                </div>
                <span className="mono" style={{ fontSize: "0.72rem" }}>HTTP 200 OK</span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Satellite Scene Loaded"
              description="Configure target latitude, longitude, and date range on the left, then click 'Search Scenes' or 'Acquire Best' to download genuine satellite data."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default SatelliteExplorer;
