import { useEffect, useState, useMemo } from "react";
import styles from "./Analytics.module.css";
import { Badge, Spinner, ErrorState } from "../components/ui";
import {
  getDisasters,
  getGallery,
  getSystemStatus,
  getAnalysisStatus,
} from "../services/api";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [disasters, setDisasters] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function loadTelemetry() {
      try {
        const [disastersRes, galleryRes, statusRes, analysisRes] = await Promise.all([
          getDisasters({ days: 60 }),
          getGallery().catch(() => ({ total: 0, images: [] })),
          getSystemStatus().catch(() => null),
          getAnalysisStatus().catch(() => null),
        ]);

        if (!ignore) {
          setDisasters(disastersRes);
          setGallery(galleryRes);
          setSystemStatus(statusRes);
          setAnalysisStatus(analysisRes);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load telemetry analytics.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadTelemetry();
    return () => {
      ignore = true;
    };
  }, []);

  // Compute real spatial and temporal metrics
  const spatialMetrics = useMemo(() => {
    const events = disasters?.events || [];
    let north = 0;
    let south = 0;
    let east = 0;
    let west = 0;
    let withCoords = 0;

    const now = new Date();
    let past7 = 0;
    let past14 = 0;
    let past30 = 0;

    events.forEach((e) => {
      if (typeof e.latitude === "number" && typeof e.longitude === "number") {
        withCoords++;
        if (e.latitude >= 0) north++;
        else south++;

        if (e.longitude >= 0) east++;
        else west++;
      }

      if (e.date) {
        const diffDays = (now - new Date(e.date)) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) past7++;
        if (diffDays <= 14) past14++;
        if (diffDays <= 30) past30++;
      }
    });

    return {
      total: events.length,
      withCoords,
      coordRatio: events.length ? Math.round((withCoords / events.length) * 100) : 0,
      north,
      south,
      east,
      west,
      past7,
      past14,
      past30,
    };
  }, [disasters]);

  // Compute storage metrics
  const storageMetrics = useMemo(() => {
    const images = Array.isArray(gallery) ? gallery : gallery?.images || [];
    const totalBytes = images.reduce((acc, img) => acc + (img.file_size_bytes || 0), 0);
    const wildfires = images.filter((i) => (i.disaster_type || "").toLowerCase().includes("wildfire")).length;
    const storms = images.filter((i) => (i.disaster_type || "").toLowerCase().includes("storm")).length;
    const taskings = images.length - wildfires - storms;

    return {
      count: images.length,
      totalBytes,
      formattedSize: formatBytes(totalBytes),
      wildfires,
      storms,
      taskings,
    };
  }, [gallery]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Analytics Engine Unavailable" message={error} />;
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Planetary Telemetry &amp; System Analytics</h1>
        <p className={styles.subtitle}>
          Operational metrics synthesized exclusively from verified NASA EONET feeds, Copernicus archives, and backend runtime state.
        </p>
      </div>

      <div className={styles.alertBox}>
        <strong>Scientific Rigour Notice:</strong> ORVIX strictly reports verified observations and deterministic calculations. Unimplemented ML detections and spectral indices are explicitly labeled as <span className="mono">not available</span>.
      </div>

      <div className={styles.grid}>
        {/* Card 1: Event Distribution */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Global Incident Census</span>
            <Badge variant="cyan">NASA EONET v3</Badge>
          </div>

          <div className={styles.metricStatRow}>
            <span className={styles.bigNum}>{disasters?.total || 0}</span>
            <span className={styles.subText}>total active planetary hazards</span>
          </div>

          <div className={styles.breakdownList}>
            <div className={styles.breakdownItem}>
              <span>Active Wildfires</span>
              <span className="mono" style={{ color: "var(--accent-amber)" }}>
                {disasters?.wildfires || 0}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Active Severe Storms</span>
              <span className="mono" style={{ color: "var(--accent-cyan)" }}>
                {disasters?.storms || 0}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Georeferenced Ratio</span>
              <span className="mono">{spatialMetrics.coordRatio}%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Spatial Distribution */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Spatial Hemispheric Division</span>
            <Badge variant="teal">Coordinates</Badge>
          </div>

          <div className={styles.breakdownList}>
            <div className={styles.breakdownItem}>
              <span>Northern Hemisphere (Lat &ge; 0°)</span>
              <span className="mono">{spatialMetrics.north} incidents</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Southern Hemisphere (Lat &lt; 0°)</span>
              <span className="mono">{spatialMetrics.south} incidents</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Eastern Hemisphere (Lon &ge; 0°)</span>
              <span className="mono">{spatialMetrics.east} incidents</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Western Hemisphere (Lon &lt; 0°)</span>
              <span className="mono">{spatialMetrics.west} incidents</span>
            </div>
          </div>
        </div>

        {/* Card 3: Temporal Recency */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Detection Recency Window</span>
            <Badge variant="emerald">Live Ingestion</Badge>
          </div>

          <div className={styles.breakdownList}>
            <div className={styles.breakdownItem}>
              <span>Detected in Past 7 Days</span>
              <span className="mono">{spatialMetrics.past7} incidents</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Detected in Past 14 Days</span>
              <span className="mono">{spatialMetrics.past14} incidents</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Detected in Past 30 Days</span>
              <span className="mono">{spatialMetrics.past30} incidents</span>
            </div>
          </div>
        </div>

        {/* Card 4: Local Storage Volume */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Satellite Archive Payload</span>
            <Badge variant="purple">Disk Storage</Badge>
          </div>

          <div className={styles.metricStatRow}>
            <span className={styles.bigNum}>{storageMetrics.count}</span>
            <span className={styles.subText}>multispectral PNG scenes</span>
          </div>

          <div className={styles.breakdownList}>
            <div className={styles.breakdownItem}>
              <span>Total Volume on Disk</span>
              <span className="mono">{storageMetrics.formattedSize}</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Wildfire Acquisitions</span>
              <span className="mono">{storageMetrics.wildfires}</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Severe Storm Acquisitions</span>
              <span className="mono">{storageMetrics.storms}</span>
            </div>
            <div className={styles.breakdownItem}>
              <span>Explorer Tasked Scenes</span>
              <span className="mono">{storageMetrics.taskings}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Infrastructure Diagnostics */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Core Subsystem Diagnostics</span>
            <Badge variant="teal">{systemStatus?.version ? `v${systemStatus.version}` : "Telemetry"}</Badge>
          </div>

          <div className={styles.breakdownList}>
            {systemStatus?.services?.map((svc) => (
              <div key={svc.name} className={styles.breakdownItem}>
                <span>{svc.name}</span>
                <span className="mono">
                  {svc.reachable ? (
                    <Badge variant="emerald">Online</Badge>
                  ) : (
                    <Badge variant="danger">Offline</Badge>
                  )}
                </span>
              </div>
            )) || (
              <div className={styles.breakdownItem}>
                <span>Subsystem Telemetry</span>
                <span className="mono">Runtime Ready</span>
              </div>
            )}
            <div className={styles.breakdownItem}>
              <span>Spectral Engine Specification</span>
              <span className="mono">
                <Badge variant="amber">{analysisStatus?.status || "Pending"}</Badge>
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: Pipeline Specifications & Unavailable Metrics */}
        <div className={styles.card} style={{ gridColumn: "1 / -1" }}>
          <div className={styles.cardTitle}>
            <span>Spectral &amp; Machine Learning Diagnostics</span>
            <Badge variant="outline">Pipeline Stage: Pending</Badge>
          </div>

          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            The following analytical indices and ML threat metrics require model weights and spectral index execution (milestone pending):
          </div>

          <div className={styles.breakdownList}>
            <div className={styles.breakdownItem}>
              <div>
                <strong>Normalized Difference Vegetation Index (NDVI)</strong>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Formula: (B08 - B04) / (B08 + B04)
                </div>
              </div>
              <span className={styles.unavailableBadge}>not available (pending pipeline implementation)</span>
            </div>

            <div className={styles.breakdownItem}>
              <div>
                <strong>Normalized Burn Ratio (NBR)</strong>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Formula: (B08 - B12) / (B08 + B12)
                </div>
              </div>
              <span className={styles.unavailableBadge}>not available (pending pipeline implementation)</span>
            </div>

            <div className={styles.breakdownItem}>
              <div>
                <strong>Neural Threat Segmentation</strong>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Architecture: U-Net / ResNet feature segmentation
                </div>
              </div>
              <span className={styles.unavailableBadge}>not available (pending model training)</span>
            </div>

            <div className={styles.breakdownItem}>
              <div>
                <strong>Atmospheric Cloud Masking</strong>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  B01 / B09 aerosol thresholding
                </div>
              </div>
              <span className={styles.unavailableBadge}>not available (pending preprocessing pipeline)</span>
            </div>

            <div className={styles.breakdownItem}>
              <div>
                <strong>Automated Confidence Rating</strong>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Calibrated posterior damage probability
                </div>
              </div>
              <span className={styles.unavailableBadge}>not available (pending model calibration)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Analytics;
