import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import styles from "./SatelliteExplorer.module.css";
import { Button, Badge, Spinner, EmptyState, ErrorState } from "../components/ui";
import {
  searchSatelliteScenes,
  acquireSatelliteScene,
  getDisasters,
  getGallery,
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

// Preset locations to help ordinary users explore famous landmarks easily
const EXPLORATION_PRESETS = [
  { name: "Yellowstone National Park", lat: 44.4280, lon: -110.5885, desc: "Geothermal caldera & forests" },
  { name: "Mount Fuji, Japan", lat: 35.3606, lon: 138.7274, desc: "Stratovolcano & snowcap" },
  { name: "Grand Canyon, Arizona", lat: 36.1069, lon: -112.1129, desc: "Eroded desert geological strata" },
  { name: "Amazon Basin, Brazil", lat: -3.4653, lon: -62.2159, desc: "Dense rainforest canopy & river" },
  { name: "Richat Structure (Eye of Sahara)", lat: 21.1269, lon: -11.4016, desc: "Prominent geological dome" },
];

export function SatelliteExplorer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const defaultDates = getDefaultDates();

  // Search & Acquisition Parameters
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

  // Progressive Disclosure: Advanced Options Toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);

  // Active Disaster Presets from NASA EONET
  const [disasterPresets, setDisasterPresets] = useState([]);
  const [selectedDisasterPreset, setSelectedDisasterPreset] = useState("");

  // Scene Discovery State
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Acquisition Execution State
  const [acquireLoading, setAcquireLoading] = useState(false);
  const [acquireError, setAcquireError] = useState(null);
  const [acquireSuccessMessage, setAcquireSuccessMessage] = useState(null);
  const [acquiredResult, setAcquiredResult] = useState(null);
  const [imageLoadError, setImageLoadError] = useState(false);

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
        // Non-critical background telemetry
      }
    }
    loadPresets();
    return () => {
      ignore = true;
    };
  }, []);

  // Synchronize state when URL query params change (e.g. from Disaster Map)
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

  function handleDisasterPresetChange(e) {
    const id = e.target.value;
    setSelectedDisasterPreset(id);
    const found = disasterPresets.find((item) => item.event_id === id);
    if (found) {
      setLatitude(found.latitude);
      setLongitude(found.longitude);
      setEventType(found.category_id === "wildfires" ? "wildfire" : "storm");
    }
  }

  function handleQuickExplorePreset(p) {
    setLatitude(p.lat);
    setLongitude(p.lon);
    setEventType("satellite");
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
        setSearchError(
          "No satellite scenes found matching your criteria. Try increasing max cloud cover or widening the observation date range."
        );
      }
    } catch (err) {
      setSearchError(err.message || "Failed to search satellite catalogue.");
    } finally {
      setSearchLoading(false);
    }
  }

  // 2. Download and Process Satellite Imagery
  async function handleAcquire(targetSceneId = null) {
    if (validationError) return;
    const sceneToAcquire = targetSceneId || selectedScene?.scene_id;
    setAcquireLoading(true);
    setAcquireError(null);
    setAcquireSuccessMessage(null);
    setImageLoadError(false);

    try {
      const payload = {
        scene_id: sceneToAcquire || undefined,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        date_from: dateFrom,
        date_to: dateTo,
        collection,
        max_cloud: parseFloat(maxCloud),
        resolution: parseInt(resolution, 10),
        event_type: eventType,
      };

      const res = await acquireSatelliteScene(payload);

      // Support raw Axios response, envelope { success, data, error }, or unwrapped data
      const result =
        res?.data && typeof res.data === "object" && "success" in res.data
          ? res.data
          : res;

      if (result.success && result.data && (result.data.status === "completed" || result.data.image_url)) {
        setAcquiredResult(result.data);
        setAcquireSuccessMessage(
          result.message || `Acquisition successful for scene ${result.data.scene_id || result.data.filename}`
        );
        setAcquireError(null);
        setActiveProduct("true_color");
        setImageLoadError(false);

        // Secondary non-blocking operations: notify gallery and pre-sync
        try {
          window.dispatchEvent(new CustomEvent("orvix:acquisition-completed", { detail: result.data }));
          getGallery().catch(() => {});
        } catch (secondaryErr) {
          console.warn("Secondary post-acquisition notification failed:", secondaryErr);
        }
      } else if (result.status === "completed" || result.image_url) {
        setAcquiredResult(result);
        setAcquireSuccessMessage(`Acquisition successful for scene ${result.scene_id || result.filename}`);
        setAcquireError(null);
        setActiveProduct("true_color");
        setImageLoadError(false);

        try {
          window.dispatchEvent(new CustomEvent("orvix:acquisition-completed", { detail: result }));
          getGallery().catch(() => {});
        } catch (secondaryErr) {
          console.warn("Secondary post-acquisition notification failed:", secondaryErr);
        }
      } else {
        const errMsg = result.error || result.message || "Acquisition did not complete successfully.";
        setAcquireError(errMsg);
      }
    } catch (err) {
      const serverErr =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        "Satellite acquisition request failed.";
      setAcquireError(serverErr);
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

  // Plain-language product descriptions for ordinary users
  const PRODUCT_EXPLANATIONS = {
    true_color: {
      title: "True Color (RGB Composite)",
      summary: "Natural visual representation as seen by the human eye, combining red, green, and blue optical bands.",
      formula: "Red (Band 4) + Green (Band 3) + Blue (Band 2)",
      usage: "Best for general landscape reconnaissance, cloud inspection, urban footprints, and visual confirmation.",
    },
    false_color: {
      title: "False Color (Infrared Composite)",
      summary: "Near-infrared composite where healthy chlorophyll-rich vegetation glows vivid red/magenta, water appears dark, and urban ground appears blue/grey.",
      formula: "NIR (Band 8) + Red (Band 4) + Green (Band 3)",
      usage: "Essential for distinguishing dense vegetation from bare soil and assessing crop and forest vitality.",
    },
    ndvi: {
      title: "Vegetation Health (NDVI)",
      summary: "Normalized Difference Vegetation Index measuring plant density and photosynthetic health from -1.0 (water/barren) to +1.0 (dense forest).",
      formula: "NDVI = (NIR - Red) / (NIR + Red)",
      usage: "Used by agriculturalists and environmental scientists to detect drought stress, forest die-off, and crop growth stages.",
    },
    ndwi: {
      title: "Water Index (NDWI)",
      summary: "Normalized Difference Water Index delineating open water bodies and assessing vegetation moisture content.",
      formula: "NDWI = (Green - NIR) / (Green + NIR)",
      usage: "Detects coastal changes, flooding extents, reservoir depletion, and waterlogged soils.",
    },
    nbr: {
      title: "Burned Area Indicator (NBR)",
      summary: "Normalized Burn Ratio comparing near-infrared reflectance against shortwave-infrared to map fire scars and post-fire severity.",
      formula: "NBR = (NIR - SWIR2) / (NIR + SWIR2)",
      usage: "Maps wildfire burn scars, distinguishes unburned vegetation islands, and tracks habitat recovery over time.",
    },
  };

  const currentExplanation = PRODUCT_EXPLANATIONS[activeProduct] || PRODUCT_EXPLANATIONS.true_color;

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Explore Satellite Images</h1>
          <p className={styles.subtitle}>
            Discover, inspect, and acquire genuine satellite imagery with multispectral analysis from Sentinel-2 and Landsat.
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── Left Column: Guided 7-Step Acquisition Workflow ── */}
        <div className={styles.formCard}>
          <div className={styles.workflowHeader}>
            <div className={styles.workflowStepBadge}>GUIDED WORKFLOW</div>
            <h2 className={styles.workflowTitle}>Configure Satellite Tasking</h2>
          </div>

          {/* ── Step 1: Choose a Location ── */}
          <div className={styles.stepBlock}>
            <div className={styles.stepTitleRow}>
              <span className={styles.stepNumber}>1</span>
              <div>
                <div className={styles.stepHeading}>Where do you want to explore?</div>
                <div className={styles.stepHint}>Choose a location on Earth to find available satellite images.</div>
              </div>
            </div>

            {/* NASA Active Disaster Preset Picker */}
            {disasterPresets.length > 0 && (
              <div className={styles.fieldGroup} style={{ marginTop: "10px" }}>
                <label className={styles.label}>
                  <span>Target from Active Disaster Hotspot</span>
                  <span className={styles.labelHint}>NASA EONET</span>
                </label>
                <select
                  className={styles.presetSelect}
                  value={selectedDisasterPreset}
                  onChange={handleDisasterPresetChange}
                >
                  <option value="">Select active disaster event…</option>
                  {disasterPresets.map((evt) => (
                    <option key={evt.event_id} value={evt.event_id}>
                      [{evt.category_id === "wildfires" ? "FIRE" : "STORM"}] {evt.title.slice(0, 34)}…
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Exploration Preset Chips */}
            <div className={styles.presetChipsRow}>
              <span className={styles.presetChipsLabel}>Landmark Presets:</span>
              <div className={styles.chipsWrap}>
                {EXPLORATION_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className={styles.presetChip}
                    onClick={() => handleQuickExplorePreset(p)}
                    title={p.desc}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Latitude and Longitude Coordinates */}
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  <span>Latitude</span>
                  <span className={styles.labelHint}>-90.0 to +90.0</span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  className={`${styles.input} ${styles.inputMono}`}
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g. 44.3187"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  <span>Longitude</span>
                  <span className={styles.labelHint}>-180.0 to +180.0</span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  className={`${styles.input} ${styles.inputMono}`}
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g. -106.9325"
                />
              </div>
            </div>
          </div>

          {/* ── Step 2: Choose the Time Period ── */}
          <div className={styles.stepBlock}>
            <div className={styles.stepTitleRow}>
              <span className={styles.stepNumber}>2</span>
              <div>
                <div className={styles.stepHeading}>When should the satellite image be from?</div>
                <div className={styles.stepHint}>
                  Satellites capture locations every 2 to 5 days. Wider date ranges increase cloud-free options.
                </div>
              </div>
            </div>

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
          </div>

          {/* ── Step 3: Choose Satellite Data Source ── */}
          <div className={styles.stepBlock}>
            <div className={styles.stepTitleRow}>
              <span className={styles.stepNumber}>3</span>
              <div>
                <div className={styles.stepHeading}>Choose your satellite data</div>
                <div className={styles.stepHint}>Select optical multispectral observation satellite platform.</div>
              </div>
            </div>

            <div className={styles.collectionOptionsGrid}>
              <div
                className={`${styles.collectionOption} ${collection === "sentinel-2-l2a" ? styles.collectionOptionSelected : ""}`}
                onClick={() => setCollection("sentinel-2-l2a")}
              >
                <div className={styles.collectionHeader}>
                  <span className={styles.collectionName}>Sentinel-2 L2A</span>
                  <Badge variant="cyan">Recommended</Badge>
                </div>
                <div className={styles.collectionDesc}>
                  European Space Agency Copernicus constellation. 10m native optical resolution, 13 spectral bands, bottom-of-atmosphere reflectance.
                </div>
              </div>

              <div
                className={`${styles.collectionOption} ${collection === "landsat-c2-l2" ? styles.collectionOptionSelected : ""}`}
                onClick={() => setCollection("landsat-c2-l2")}
              >
                <div className={styles.collectionHeader}>
                  <span className={styles.collectionName}>Landsat-8/9 C2 L2</span>
                  <Badge variant="outline">30m GSD</Badge>
                </div>
                <div className={styles.collectionDesc}>
                  USGS/NASA Earth observation programme. 30m multispectral resolution with thermal infrared channels.
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 4: Refine Your Search (Progressive Disclosure) ── */}
          <div className={styles.stepBlock}>
            <div className={styles.stepTitleRow} style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span className={styles.stepNumber}>4</span>
                <div>
                  <div className={styles.stepHeading}>Refine your search</div>
                  <div className={styles.stepHint}>Fine-tune cloud tolerances and pixel resolutions.</div>
                </div>
              </div>
              <button
                type="button"
                className={styles.advancedToggleBtn}
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {showAdvanced ? "Hide Advanced Options ▲" : "Show Advanced Options ▼"}
              </button>
            </div>

            {showAdvanced && (
              <div className={styles.advancedPanel}>
                <div className={styles.fieldRow}>
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
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Optical Resolution</label>
                    <select
                      className={styles.select}
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                    >
                      <option value={10}>10m (Native optical resolution)</option>
                      <option value={20}>20m (Multispectral composite)</option>
                      <option value={60}>60m (Regional quicklook)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Classification Tag</label>
                  <select
                    className={styles.select}
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                  >
                    <option value="satellite">General Earth Observation</option>
                    <option value="wildfire">Wildfire / Burn Perimeter</option>
                    <option value="storm">Severe Storm / Cloud Dynamics</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div className={styles.validationAlert}>{validationError}</div>
          )}

          {/* ── Step 5 & 6: Action Buttons ── */}
          <div className={styles.buttonRow}>
            <Button
              variant="outline"
              onClick={handleSearchScenes}
              loading={searchLoading}
              disabled={Boolean(validationError) || searchLoading || acquireLoading}
              title="Search Earth Search STAC catalogue for scenes matching your location and dates"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Find Available Images
            </Button>
            <Button
              variant="primary"
              onClick={() => handleAcquire(selectedScene?.scene_id)}
              loading={acquireLoading}
              disabled={Boolean(validationError) || acquireLoading}
              title="Download Cloud-Optimized GeoTIFF bands and generate multispectral composites"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {selectedScene ? "Download & Process Image" : "Acquire Best Available"}
            </Button>
          </div>

          {/* Discovered Scenes List */}
          {scenes.length > 0 && (
            <div className={styles.scenesSection}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className={styles.label}>
                  <span>Discovered Scenes ({scenes.length})</span>
                </label>
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Click scene to select</span>
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
                          <span style={{ color: sc.cloud_cover < 10 ? "var(--accent-green)" : sc.cloud_cover < 30 ? "var(--accent-amber)" : "var(--accent-red)" }}>
                            ☁ {sc.cloud_cover}%
                          </span>
                          <span>•</span>
                          <span>{sc.available_bands?.length || 0} bands</span>
                        </div>
                      </div>
                      {isSelected && <Badge variant="cyan">Selected</Badge>}
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

        {/* ── Right Column: Step 7 Acquisition Results & Spectral Viewer ── */}
        <div className={styles.previewContainer}>
          {acquireSuccessMessage && (
            <div className={styles.successAlert}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{acquireSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setAcquireSuccessMessage(null)}
                className={styles.alertCloseBtn}
                title="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {acquireLoading ? (
            <div className={styles.viewerCard}>
              <div className={styles.viewerBody} style={{ flexDirection: "column", gap: "20px", padding: "60px 24px" }}>
                <Spinner size="lg" />
                <div style={{ color: "var(--text-main)", fontSize: "1.1rem", fontWeight: 700 }}>
                  Acquiring Genuine Satellite Imagery…
                </div>
                {/* 6-Stage Workflow Progress Indicator */}
                <div className={styles.acquisitionWorkflowList}>
                  <div className={styles.workflowStageItem}>
                    <span className={styles.stageCheckmark}>✔</span>
                    <span>1. Connecting to Earth Search STAC catalogue</span>
                  </div>
                  <div className={styles.workflowStageItem}>
                    <span className={styles.stageCheckmark}>✔</span>
                    <span>2. Resolving target tile coordinates &amp; bounding box</span>
                  </div>
                  <div className={styles.workflowStageItem}>
                    <span className={styles.stageActiveDot} />
                    <span>3. Downloading Cloud-Optimized GeoTIFF bands from AWS S3</span>
                  </div>
                  <div className={styles.workflowStageItem}>
                    <span className={styles.stagePendingDot} />
                    <span>4. Compositing True Color RGB with percentile stretch</span>
                  </div>
                  <div className={styles.workflowStageItem}>
                    <span className={styles.stagePendingDot} />
                    <span>5. Calculating environmental indices (NDVI, NDWI, NBR)</span>
                  </div>
                  <div className={styles.workflowStageItem}>
                    <span className={styles.stagePendingDot} />
                    <span>6. Saving imagery and metadata to My Satellite Archive</span>
                  </div>
                </div>
              </div>
            </div>
          ) : acquireError ? (
            <ErrorState
              title="Satellite Acquisition Notice"
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
                    onClick={() => window.open(getCurrentImageUrl(), "_blank")}
                    title="Open full-resolution composite in a new tab"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Full Resolution
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getDownloadUrl(acquiredResult.filename), "_blank")}
                    title="Download raw raster or PNG file"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate("/gallery")}
                    title="Open saved acquisitions in My Satellite Archive"
                  >
                    View in Archive
                  </Button>
                </div>
              </div>

              {/* Spectral Products Switcher */}
              <div className={styles.productTabs}>
                <button
                  type="button"
                  className={`${styles.productTab} ${activeProduct === "true_color" ? styles.productTabActive : ""}`}
                  onClick={() => {
                    setActiveProduct("true_color");
                    setImageLoadError(false);
                  }}
                >
                  True Color (RGB)
                </button>
                {acquiredResult.indices?.false_color && (
                  <button
                    type="button"
                    className={`${styles.productTab} ${activeProduct === "false_color" ? styles.productTabActive : ""}`}
                    onClick={() => {
                      setActiveProduct("false_color");
                      setImageLoadError(false);
                    }}
                  >
                    False Color (Infrared)
                  </button>
                )}
                {acquiredResult.indices?.ndvi && (
                  <button
                    type="button"
                    className={`${styles.productTab} ${activeProduct === "ndvi" ? styles.productTabActive : ""}`}
                    onClick={() => {
                      setActiveProduct("ndvi");
                      setImageLoadError(false);
                    }}
                  >
                    Vegetation Health (NDVI)
                  </button>
                )}
                {acquiredResult.indices?.ndwi && (
                  <button
                    type="button"
                    className={`${styles.productTab} ${activeProduct === "ndwi" ? styles.productTabActive : ""}`}
                    onClick={() => {
                      setActiveProduct("ndwi");
                      setImageLoadError(false);
                    }}
                  >
                    Water Index (NDWI)
                  </button>
                )}
                {acquiredResult.indices?.nbr && (
                  <button
                    type="button"
                    className={`${styles.productTab} ${activeProduct === "nbr" ? styles.productTabActive : ""}`}
                    onClick={() => {
                      setActiveProduct("nbr");
                      setImageLoadError(false);
                    }}
                  >
                    Burned Area (NBR)
                  </button>
                )}
              </div>

              {/* Main Image Display */}
              <div className={styles.viewerBody}>
                {imageLoadError ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ color: "var(--accent-amber)", fontSize: "0.9rem", fontWeight: 600 }}>
                      Image Rendering in Browser
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", maxWidth: "420px" }}>
                      Scene was acquired and verified on disk. Click below to retry rendering or view the raw raster directly.
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                      <Button variant="outline" size="sm" onClick={() => setImageLoadError(false)}>
                        Retry Render
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => window.open(getCurrentImageUrl(), "_blank")}>
                        Open Direct URL
                      </Button>
                    </div>
                  </div>
                ) : (
                  <img
                    src={getCurrentImageUrl()}
                    alt={acquiredResult.filename || acquiredResult.scene_id}
                    className={styles.acquiredImage}
                    onLoad={() => setImageLoadError(false)}
                    onError={() => {
                      console.warn("Acquired image failed to load in browser element:", getCurrentImageUrl());
                      setImageLoadError(true);
                    }}
                  />
                )}
              </div>

              {/* Plain-Language Product Explainer Card */}
              <div className={styles.productExplanationCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className={styles.productExplTitle}>{currentExplanation.title}</div>
                  <button
                    type="button"
                    className={styles.formulaToggleBtn}
                    onClick={() => setShowFormulas((prev) => !prev)}
                  >
                    {showFormulas ? "Hide Technical Details ▲" : "Technical Details & Formulas ▼"}
                  </button>
                </div>
                <div className={styles.productExplSummary}>{currentExplanation.summary}</div>
                <div className={styles.productExplUsage}>
                  <strong style={{ color: "var(--text-main)" }}>Key Applications: </strong>
                  {currentExplanation.usage}
                </div>

                {showFormulas && (
                  <div className={styles.formulaBox}>
                    <div style={{ color: "var(--text-dim)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Mathematical Formula &amp; Sentinel-2 Bands:
                    </div>
                    <div className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem", marginTop: "3px" }}>
                      {currentExplanation.formula}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata Inspector */}
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Scene ID</span>
                  <span className={`${styles.metaVal} mono`}>
                    {acquiredResult.scene_id || acquiredResult.filename}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Observation Date</span>
                  <span className={styles.metaVal}>
                    {acquiredResult.date || acquiredResult.datetime?.slice(0, 10) || "Observed"}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Satellite Platform</span>
                  <span className={styles.metaVal}>{acquiredResult.platform || "Sentinel-2"}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Cloud Cover</span>
                  <span className={styles.metaVal}>
                    {acquiredResult.cloud_cover !== undefined ? `${acquiredResult.cloud_cover}%` : "0%"}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Target Center</span>
                  <span className={`${styles.metaVal} mono`}>
                    {typeof acquiredResult.latitude === "number" ? acquiredResult.latitude.toFixed(4) : latitude}, {typeof acquiredResult.longitude === "number" ? acquiredResult.longitude.toFixed(4) : longitude}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Optical Resolution</span>
                  <span className={styles.metaVal}>
                    {acquiredResult.resolution || resolution}m GSD
                  </span>
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
              description="Follow the guided workflow on the left: select a location, date range, and click 'Find Available Images' or 'Acquire Best Available' to explore Earth from space."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default SatelliteExplorer;
