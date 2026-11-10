import { useEffect, useState, useCallback } from "react";
import styles from "./Overview.module.css";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Spinner,
  Button,
  EmptyState,
  ErrorState,
} from "../components/ui";
import {
  getDisasters,
  getLatestImage,
  getGallery,
  getAnalysisStatus,
} from "../services/api";

export function Overview() {
  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    wildfires: 0,
    storms: 0,
    imageCount: 0,
  });
  const [events, setEvents] = useState([]);
  const [latestImage, setLatestImage] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const loadDashboardData = useCallback(async () => {
    setError(null);
    try {
      const [disastersData, galleryData, analysisData] = await Promise.all([
        getDisasters({ days: 30 }),
        getGallery().catch(() => ({ total: 0, images: [] })),
        getAnalysisStatus().catch(() => null),
      ]);

      const eventsList = disastersData?.events || [];
      const wfCount = disastersData?.wildfires || 0;
      const stCount = disastersData?.storms || 0;
      const imgTotal = galleryData?.total || 0;

      setMetrics({
        totalEvents: eventsList.length,
        wildfires: wfCount,
        storms: stCount,
        imageCount: imgTotal,
      });

      setEvents(eventsList);
      setPipelineStatus(analysisData);

      // Try latest image
      try {
        const latest = await getLatestImage();
        setLatestImage(latest);
      } catch {
        setLatestImage(null);
      }
    } catch (err) {
      setError(err.message || "Failed to load telemetry from ORVIX backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      await loadDashboardData();
    }
    if (isMounted) {
      init();
    }
    return () => {
      isMounted = false;
    };
  }, [loadDashboardData]);

  // Filter events by selected category tab
  const filteredEvents = events.filter((ev) => {
    if (activeCategory === "wildfires") return ev.category_id === "wildfires";
    if (activeCategory === "storms") return ev.category_id === "severeStorms";
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Header Banner */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Earth Intelligence Overview</h1>
          <p className={styles.pageSub}>
            Real-time geospatial hazard telemetry from NASA EONET and Copernicus Sentinel-2.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setLoading(true);
            loadDashboardData();
          }}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh Telemetry"}
        </Button>
      </div>

      {error && (
        <ErrorState
          title="Telemetry Connection Notice"
          error={error}
          onRetry={loadDashboardData}
          className={styles.errorBanner}
        />
      )}

      {/* Metrics Row */}
      <div className={styles.metricsGrid}>
        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>ACTIVE HAZARDS</div>
            <div className={styles.metricValue}>
              {loading ? <Spinner size="18px" /> : metrics.totalEvents}
            </div>
            <div className={styles.metricFooter}>Across Global Monitored Zones</div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>ACTIVE WILDFIRES</div>
            <div className={`${styles.metricValue} ${styles.valOrange}`}>
              {loading ? <Spinner size="18px" /> : metrics.wildfires}
            </div>
            <div className={styles.metricFooter}>NASA EONET Category: wildfires</div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>SEVERE STORMS</div>
            <div className={`${styles.metricValue} ${styles.valRed}`}>
              {loading ? <Spinner size="18px" /> : metrics.storms}
            </div>
            <div className={styles.metricFooter}>NASA EONET Category: severeStorms</div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>STORED IMAGERY</div>
            <div className={`${styles.metricValue} ${styles.valCyan}`}>
              {loading ? <Spinner size="18px" /> : metrics.imageCount}
            </div>
            <div className={styles.metricFooter}>Sentinel-2 Tiles on Local Disk</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Layout */}
      <div className={styles.twoColumnGrid}>
        {/* Left Column: Active Events Feed */}
        <section className={styles.leftCol}>
          <Card>
            <CardHeader className={styles.cardHeaderFlex}>
              <div>
                <CardTitle>Active Disaster Events</CardTitle>
                <CardDescription>
                  Verified natural occurrences reported within the last 30 days.
                </CardDescription>
              </div>
              <div className={styles.tabGroup}>
                <button
                  className={`${styles.tabBtn} ${activeCategory === "all" ? styles.tabActive : ""}`}
                  onClick={() => setActiveCategory("all")}
                >
                  All ({metrics.totalEvents})
                </button>
                <button
                  className={`${styles.tabBtn} ${activeCategory === "wildfires" ? styles.tabActive : ""}`}
                  onClick={() => setActiveCategory("wildfires")}
                >
                  Wildfires ({metrics.wildfires})
                </button>
                <button
                  className={`${styles.tabBtn} ${activeCategory === "storms" ? styles.tabActive : ""}`}
                  onClick={() => setActiveCategory("storms")}
                >
                  Storms ({metrics.storms})
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className={styles.loadingWrapper}>
                  <Spinner size="24px" color="var(--accent-cyan)" />
                  <span>Loading NASA EONET events...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <EmptyState
                  title="No active events found"
                  description="No natural disasters reported matching the selected category."
                />
              ) : (
                <div className={styles.eventsList}>
                  {filteredEvents.map((event) => {
                    const isFire = event.category_id === "wildfires";
                    const lat = event.latitude !== null ? event.latitude?.toFixed(4) : "N/A";
                    const lon = event.longitude !== null ? event.longitude?.toFixed(4) : "N/A";

                    return (
                      <div key={event.event_id} className={styles.eventRow}>
                        <div className={styles.eventMain}>
                          <div className={styles.eventTitleRow}>
                            <Badge variant={isFire ? "orange" : "red"}>
                              {event.category || "Hazard"}
                            </Badge>
                            <span className={styles.eventId}>{event.event_id}</span>
                            {event.date && (
                              <span className={styles.eventDate}>
                                {new Date(event.date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className={styles.eventTitle}>{event.title}</div>
                          <div className={styles.eventCoordinates}>
                            <span>LAT: <span className="mono">{lat}</span></span>
                            <span>LON: <span className="mono">{lon}</span></span>
                          </div>
                        </div>
                        {event.source_url && (
                          <a
                            href={event.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.sourceBtn}
                            title="Open incident agency report"
                          >
                            <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Right Column: Latest Acquisition & Pipeline */}
        <div className={styles.rightCol}>
          {/* Latest Imagery Card */}
          <Card>
            <CardHeader>
              <CardTitle>Latest Satellite Acquisition</CardTitle>
              <CardDescription>Most recent optical tile stored on local storage.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className={styles.loadingWrapper}>
                  <Spinner size="24px" />
                </div>
              ) : latestImage ? (
                <div className={styles.imageTile}>
                  <div className={styles.imagePreviewWrap}>
                    <img
                      src={latestImage.image_url}
                      alt={latestImage.filename}
                      className={styles.imagePreview}
                    />
                  </div>
                  <div className={styles.imageMetaTable}>
                    <div className={styles.metaRow}>
                      <span className={styles.metaKey}>Filename:</span>
                      <span className={styles.metaValMono}>{latestImage.filename}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaKey}>Acquisition:</span>
                      <span className={styles.metaVal}>{latestImage.date || "N/A"}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaKey}>Coordinates:</span>
                      <span className={styles.metaValMono}>
                        Lat {latestImage.latitude?.toFixed(4)}, Lon {latestImage.longitude?.toFixed(4)}
                      </span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaKey}>File Size:</span>
                      <span className={styles.metaVal}>
                        {(latestImage.file_size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No satellite imagery stored"
                  description="Use the Sentinel-2 image acquisition endpoint or run automated monitoring to download tiles."
                />
              )}
            </CardContent>
          </Card>

          {/* Earth Intelligence Analysis Status */}
          <Card>
            <CardHeader>
              <div className={styles.pipelineTitleRow}>
                <CardTitle>Earth Intelligence Pipeline</CardTitle>
                <Badge variant="cyan">STATUS: PENDING</Badge>
              </div>
              <CardDescription>
                Formal mathematical interfaces for radiometric calibration and spectral detection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={styles.pipelineList}>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>1. Spatial &amp; Band Validation</div>
                    <div className={styles.stageDesc}>Validates channels, bit-depth, nodata percentages</div>
                  </div>
                  <Badge variant="outline">
                    {pipelineStatus?.stages?.validation?.toUpperCase() || "PENDING"}
                  </Badge>
                </div>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>2. Radiometric Preprocessing</div>
                    <div className={styles.stageDesc}>Atmospheric correction and dynamic normalization</div>
                  </div>
                  <Badge variant="outline">
                    {pipelineStatus?.stages?.preprocessing?.toUpperCase() || "PENDING"}
                  </Badge>
                </div>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>3. Spectral Indices (NDVI / NBR)</div>
                    <div className={styles.stageDesc}>B08/B04 vegetation &amp; B08/B12 burn ratio formulas</div>
                  </div>
                  <Badge variant="outline">
                    {pipelineStatus?.stages?.spectral_indices?.ndvi?.toUpperCase() || "PENDING"}
                  </Badge>
                </div>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>4. Neural Model Inference</div>
                    <div className={styles.stageDesc}>Disaster classification &amp; spatial segmentation</div>
                  </div>
                  <Badge variant="outline">
                    {pipelineStatus?.stages?.model?.toUpperCase() || "PENDING"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
