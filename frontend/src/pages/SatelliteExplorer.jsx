import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import styles from "./SatelliteExplorer.module.css";
import { Button, Badge, Spinner, EmptyState, ErrorState } from "../components/ui";
import { postCaptureImage, getDisasters, API_BASE_URL } from "../services/api";

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
  past.setDate(now.getDate() - 30);
  return {
    from: past.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export function SatelliteExplorer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const defaultDates = getDefaultDates();

  // Form parameters
  const [latitude, setLatitude] = useState(
    searchParams.get("lat") ? parseFloat(searchParams.get("lat")) : 44.3187
  );
  const [longitude, setLongitude] = useState(
    searchParams.get("lon") ? parseFloat(searchParams.get("lon")) : -106.9325
  );
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [resolution, setResolution] = useState(60);
  const [bboxSize, setBboxSize] = useState(0.05);
  const [eventType, setEventType] = useState(searchParams.get("type") || "satellite");

  // Telemetry presets from NASA
  const [disasterPresets, setDisasterPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState("");

  // Acquisition execution state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [acquiredResult, setAcquiredResult] = useState(null);

  // Load active events for presets
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
        // Non-critical: presets are convenience only
      }
    }
    loadPresets();
    return () => {
      ignore = true;
    };
  }, []);

  // Synchronize state when search parameters change (React pattern for prop/searchParam sync)
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

  async function handleAcquire() {
    if (validationError) return;
    setLoading(true);
    setError(null);

    try {
      const data = await postCaptureImage({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        date_from: dateFrom,
        date_to: dateTo,
        resolution: parseInt(resolution, 10),
        bbox_size: parseFloat(bboxSize),
        event_type: eventType,
      });
      setAcquiredResult(data);
    } catch (err) {
      setError(err.message || "Satellite acquisition request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Satellite Explorer &amp; Tasking</h1>
        <p className={styles.subtitle}>
          Interactive Sentinel-2 L2A true-colour tasking via Copernicus Data Space Ecosystem (CDSE).
        </p>
      </div>

      <div className={styles.layout}>
        {/* Left Parameters Card */}
        <div className={styles.formCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>Tasking Parameters</h2>
            <Badge variant="teal">Sentinel-2 L2A</Badge>
          </div>

          {/* Preset Selector */}
          {disasterPresets.length > 0 && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span>Load Target from Active Event</span>
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
                    [{evt.category_id === "wildfires" ? "FIRE" : "STORM"}] {evt.title.slice(0, 36)}…
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

          {/* Resolution & Bounding Box */}
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Resolution</label>
              <select
                className={styles.select}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value={10}>10m (Native optical)</option>
                <option value={20}>20m (Multispectral)</option>
                <option value={60}>60m (Regional scene)</option>
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>BBox Half-Extent</label>
              <select
                className={styles.select}
                value={bboxSize}
                onChange={(e) => setBboxSize(e.target.value)}
              >
                <option value={0.02}>0.02° (~2.2 km)</option>
                <option value={0.05}>0.05° (~5.5 km)</option>
                <option value={0.10}>0.10° (~11.1 km)</option>
              </select>
            </div>
          </div>

          {/* Event Classification Tag */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Archive Classification Tag</label>
            <select
              className={styles.select}
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="satellite">Satellite Capture</option>
              <option value="wildfire">Wildfire Incident</option>
              <option value="storm">Severe Storm Incident</option>
            </select>
          </div>

          {/* Validation Feedback */}
          {validationError && (
            <div className={styles.validationAlert}>{validationError}</div>
          )}

          {/* Action Trigger */}
          <Button
            variant="primary"
            onClick={handleAcquire}
            loading={loading}
            disabled={Boolean(validationError) || loading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Task Sentinel-2 Scene
          </Button>
        </div>

        {/* Right Output View */}
        <div className={styles.previewContainer}>
          {loading ? (
            <div className={styles.viewerCard}>
              <div className={styles.viewerBody} style={{ flexDirection: "column", gap: "16px" }}>
                <Spinner size="lg" />
                <div style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                  Requesting Sentinel-2 Level-2A granules from CDSE Processing Node…
                </div>
              </div>
            </div>
          ) : error ? (
            <ErrorState
              title="Copernicus Acquisition Failed"
              message={error}
              onRetry={handleAcquire}
            />
          ) : acquiredResult ? (
            <div className={styles.viewerCard}>
              <div className={styles.viewerHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Badge variant="emerald">Acquisition Verified</Badge>
                  <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {acquiredResult.filename}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/gallery")}
                >
                  View in Gallery
                </Button>
              </div>

              <div className={styles.viewerBody}>
                <img
                  src={`${API_BASE_URL}/${acquiredResult.image_path}`}
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
                  <span className={styles.metaKey}>Acquisition Date</span>
                  <span className={styles.metaVal}>{acquiredResult.date || "Observed"}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Resolution</span>
                  <span className={styles.metaVal}>
                    {acquiredResult.resolution_meters ? `${acquiredResult.resolution_meters}m / px` : `${resolution}m`}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Image Dimensions</span>
                  <span className={`${styles.metaVal} mono`}>
                    {acquiredResult.image_size_pixels
                      ? `${acquiredResult.image_size_pixels[0]} × ${acquiredResult.image_size_pixels[1]}`
                      : "512 × 512"}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Disk Payload</span>
                  <span className={`${styles.metaVal} mono`}>
                    {formatBytes(acquiredResult.file_size_bytes)}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Data Source</span>
                  <span className={styles.metaVal}>Copernicus CDSE S2L2A</span>
                </div>
              </div>

              <div className={styles.persistedNotice}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Persisted to local storage (<code>backend/{acquiredResult.image_path}</code>) &amp; indexed in gallery database.</span>
                </div>
                <span className="mono" style={{ fontSize: "0.72rem" }}>HTTP 200 OK</span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Satellite Scene Loaded"
              description="Configure target latitude, longitude, and date range on the left, then click 'Task Sentinel-2 Scene' to download optical imagery."
            />
          )}
        </div>
      </div>
    </div>
  );
}
export default SatelliteExplorer;
