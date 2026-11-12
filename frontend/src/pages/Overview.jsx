import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

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
      {/* ── 1. Hero Section: Clear Product Purpose & Primary Actions ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroDot} />
            <span>ORVIX EARTH INTELLIGENCE</span>
          </div>
          <h1 className={styles.heroHeading}>Understand What&apos;s Happening Across Earth</h1>
          <p className={styles.heroDescription}>
            Explore our planet through satellite imagery and geospatial intelligence. Discover environmental changes,
            monitor natural disasters and analyse Earth&apos;s surface using real Earth observation data.
          </p>

          <div className={styles.heroActions}>
            <div
              className={styles.actionCard}
              onClick={() => navigate("/explorer")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/explorer")}
            >
              <div className={styles.actionIconWrap}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              </div>
              <div className={styles.actionText}>
                <div className={styles.actionTitle}>Explore Satellite Images</div>
                <div className={styles.actionDesc}>Find satellite imagery for any location and date range.</div>
              </div>
              <span className={styles.actionArrow}>→</span>
            </div>

            <div
              className={styles.actionCard}
              onClick={() => navigate("/monitoring")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/monitoring")}
            >
              <div className={styles.actionIconWrap}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                </svg>
              </div>
              <div className={styles.actionText}>
                <div className={styles.actionTitle}>View Disaster Map</div>
                <div className={styles.actionDesc}>Explore reported wildfires, storms and other natural events.</div>
              </div>
              <span className={styles.actionArrow}>→</span>
            </div>

            <div
              className={styles.actionCard}
              onClick={() => navigate("/analytics")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/analytics")}
            >
              <div className={styles.actionIconWrap}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div className={styles.actionText}>
                <div className={styles.actionTitle}>Analyse Satellite Images</div>
                <div className={styles.actionDesc}>Explore vegetation, water and burned-area indicators.</div>
              </div>
              <span className={styles.actionArrow}>→</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Dashboard Header Row ── */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.pageTitle}>Earth Dashboard</h2>
          <p className={styles.pageSub}>
            Live summary of natural events, satellite acquisitions, and environmental indicators.
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

      {/* ── 3. Metrics Row: Clear, Humanized Descriptions ── */}
      <div className={styles.metricsGrid}>
        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>ACTIVE NATURAL DISASTERS</div>
            <div className={styles.metricValue}>
              {loading ? <Spinner size="18px" /> : metrics.totalEvents}
            </div>
            <div className={styles.metricFooter}>
              Active events reported globally by NASA EONET in the last 30 days.
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>ACTIVE WILDFIRES TRACKED</div>
            <div className={`${styles.metricValue} ${styles.valOrange}`}>
              {loading ? <Spinner size="18px" /> : metrics.wildfires}
            </div>
            <div className={styles.metricFooter}>
              Thermal anomalies and bushfires verified by remote sensing.
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>SEVERE STORM SYSTEMS</div>
            <div className={`${styles.metricValue} ${styles.valRed}`}>
              {loading ? <Spinner size="18px" /> : metrics.storms}
            </div>
            <div className={styles.metricFooter}>
              Cyclones, hurricanes, and severe convective weather systems.
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent className={styles.metricCard}>
            <div className={styles.metricLabel}>SATELLITE IMAGES COLLECTED</div>
            <div className={`${styles.metricValue} ${styles.valCyan}`}>
              {loading ? <Spinner size="18px" /> : metrics.imageCount}
            </div>
            <div className={styles.metricFooter}>
              Multi-spectral scenes and indices stored in your archive.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Main Two-Column Layout ── */}
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
                              {event.category || (isFire ? "Wildfire" : "Severe Storm")}
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

                        <div className={styles.eventActionGroup}>
                          {typeof event.latitude === "number" && typeof event.longitude === "number" && (
                            <button
                              className={styles.taskBtn}
                              onClick={() =>
                                navigate(
                                  `/explorer?lat=${event.latitude}&lon=${event.longitude}&type=${
                                    isFire ? "wildfire" : "storm"
                                  }`
                                )
                              }
                              title="Inspect this event in Satellite Explorer"
                            >
                              Explore Scene →
                            </button>
                          )}
                          {event.source_url && (
                            <a
                              href={event.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.sourceBtn}
                              title="Open NASA EONET source dossier"
                            >
                              <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          )}
                        </div>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <CardTitle>Latest Satellite Acquisition</CardTitle>
                  <CardDescription>Most recent optical tile stored on local storage.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/gallery")}>
                  View Archive
                </Button>
              </div>
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
                      <span className={styles.metaKey}>Observation Date:</span>
                      <span className={styles.metaVal}>{latestImage.date || "Observed"}</span>
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
                  description="Use the Satellite Explorer or run automated monitoring to download and composite scenes."
                />
              )}
            </CardContent>
          </Card>

          {/* Earth Intelligence Pipeline Status */}
          <Card>
            <CardHeader>
              <div className={styles.pipelineTitleRow}>
                <CardTitle>Earth Intelligence Pipeline</CardTitle>
                <Badge variant="cyan">RADIOMETRIC &amp; SPECTRAL</Badge>
              </div>
              <CardDescription>
                Automated multi-spectral processing stages computed upon acquisition.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={styles.pipelineList}>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>1. Spatial &amp; Band Validation</div>
                    <div className={styles.stageDesc}>Validates channels, bit-depth, nodata percentages</div>
                  </div>
                  <Badge variant="emerald">
                    {pipelineStatus?.stages?.validation?.toUpperCase() || "READY"}
                  </Badge>
                </div>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>2. Radiometric Preprocessing</div>
                    <div className={styles.stageDesc}>Atmospheric correction and dynamic normalization</div>
                  </div>
                  <Badge variant="emerald">
                    {pipelineStatus?.stages?.preprocessing?.toUpperCase() || "READY"}
                  </Badge>
                </div>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>3. Spectral Indices (NDVI, NDWI, NBR)</div>
                    <div className={styles.stageDesc}>Vegetation health, water index, and burn severity composites</div>
                  </div>
                  <Badge variant="emerald">
                    {pipelineStatus?.stages?.spectral_indices?.ndvi?.toUpperCase() || "ACTIVE"}
                  </Badge>
                </div>
                <div className={styles.stageItem}>
                  <div>
                    <div className={styles.stageName}>4. Neural Model Inference</div>
                    <div className={styles.stageDesc}>Disaster classification &amp; spatial segmentation</div>
                  </div>
                  <Badge variant="outline">
                    {pipelineStatus?.stages?.model?.toUpperCase() || "STANDBY"}
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

export default Overview;
