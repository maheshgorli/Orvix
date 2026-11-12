import { useEffect, useState, useCallback } from "react";
import styles from "./Settings.module.css";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Spinner,
  Button,
  ErrorState,
} from "../components/ui";
import {
  getSystemStatus,
  getTokenInfo,
  getAnalysisStatus,
  API_BASE_URL,
} from "../services/api";

export function Settings() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [pipelineInfo, setPipelineInfo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadHealthData = useCallback(async () => {
    setError(null);
    try {
      const [statusRes, analysisRes] = await Promise.all([
        getSystemStatus(),
        getAnalysisStatus().catch(() => null),
      ]);
      setSystemStatus(statusRes);
      setPipelineInfo(analysisRes);

      // Fetch token info separately to handle unauthenticated state gracefully
      try {
        const tInfo = await getTokenInfo();
        setTokenInfo(tInfo);
      } catch {
        setTokenInfo(null);
      }
    } catch (err) {
      setError(err.message || "Failed to query system status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      await loadHealthData();
    }
    if (isMounted) {
      init();
    }
    return () => {
      isMounted = false;
    };
  }, [loadHealthData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHealthData();
  };

  const services = systemStatus?.services || [];

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Settings &amp; Data Sources</h1>
          <p className={styles.pageSub}>
            Subsystem health diagnostics, satellite data providers, and platform runtime configuration.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          {refreshing ? <Spinner size="14px" /> : "Refresh Health"}
        </Button>
      </div>

      {error && (
        <ErrorState
          title="Diagnostics Check Failed"
          message={error}
          onRetry={loadHealthData}
          className={styles.banner}
        />
      )}

      {/* ── Integrated Subsystems ── */}
      <section>
        <div className={styles.sectionHeading}>INTEGRATED DATA PROVIDERS &amp; SERVICES</div>
        {loading ? (
          <div className={styles.loadingRow}>
            <Spinner size="24px" color="var(--accent-cyan)" />
            <span>Probing subsystem endpoints…</span>
          </div>
        ) : (
          <div className={styles.servicesGrid}>
            {services.map((svc) => (
              <Card key={svc.name} hover>
                <CardHeader className={styles.serviceHeader}>
                  <div className={styles.serviceTitleRow}>
                    <CardTitle>{svc.name}</CardTitle>
                    <Badge variant={svc.reachable ? "emerald" : "danger"} dot>
                      {svc.reachable ? "ONLINE" : "OFFLINE"}
                    </Badge>
                  </div>
                  <CardDescription>
                    HTTP Status: {svc.status_code ? svc.status_code : "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={styles.serviceMessage}>{svc.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Two Column Grid: Data Providers & Spectral Engine ── */}
      <div className={styles.twoColumnGrid}>
        {/* Satellite Data Providers */}
        <section className={styles.col}>
          <Card>
            <CardHeader>
              <div className={styles.cardHeaderFlex}>
                <CardTitle>Satellite Data Sources</CardTitle>
                <Badge variant="emerald">PRIMARY: ACTIVE</Badge>
              </div>
              <CardDescription>
                Public and authenticated satellite constellation APIs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={styles.specsList}>
                <div className={styles.specItem}>
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>Earth Search STAC (AWS Element 84)</strong>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      Sentinel-2 L2A (COGs) &amp; Landsat-8/9 C2 L2 (No API key needed)
                    </div>
                  </div>
                  <Badge variant="emerald">ACTIVE (PRIMARY)</Badge>
                </div>

                <div className={styles.specItem}>
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>NASA EONET v3 Feed</strong>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      Earth Observatory Natural Event Tracker (Public REST API)
                    </div>
                  </div>
                  <Badge variant="emerald">ACTIVE</Badge>
                </div>

                <div className={styles.specItem}>
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>Copernicus CDSE OAuth2</strong>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      Sentinel Hub authentication (Optional secondary provider)
                    </div>
                  </div>
                  <Badge variant={tokenInfo ? "emerald" : "outline"}>
                    {tokenInfo ? "CONFIGURED" : "OPTIONAL / NOT SET"}
                  </Badge>
                </div>

                {tokenInfo ? (
                  <div className={styles.tokenDataGrid} style={{ marginTop: "8px" }}>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>Expires In:</span>
                      <span className={`${styles.fieldValueMono} ${styles.greenText}`}>
                        {tokenInfo.seconds_remaining} seconds
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className={styles.specNote}>
                    Earth Search STAC is the default primary provider and does not require credentials. You can acquire Sentinel-2 imagery immediately without any API keys.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Spectral & Analysis Engine */}
        <section className={styles.col}>
          <Card>
            <CardHeader>
              <div className={styles.cardHeaderFlex}>
                <CardTitle>Spectral Analysis Capabilities</CardTitle>
                <Badge variant="cyan">ENGINE: OPERATIONAL</Badge>
              </div>
              <CardDescription>
                Multispectral indices computed during scene acquisition.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={styles.specsList}>
                <div className={styles.specItem}>
                  <div>
                    <span className={styles.specKey}>True Color RGB</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      Bands B04, B03, B02 (10m GSD)
                    </div>
                  </div>
                  <Badge variant="emerald">OPERATIONAL</Badge>
                </div>

                <div className={styles.specItem}>
                  <div>
                    <span className={styles.specKey}>Color-Infrared False Color</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      Bands B08 (NIR), B04 (Red), B03 (Green)
                    </div>
                  </div>
                  <Badge variant="emerald">OPERATIONAL</Badge>
                </div>

                <div className={styles.specItem}>
                  <div>
                    <span className={styles.specKey}>NDVI (Vegetation Index)</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      (B08 - B04) / (B08 + B04)
                    </div>
                  </div>
                  <Badge variant="emerald">OPERATIONAL</Badge>
                </div>

                <div className={styles.specItem}>
                  <div>
                    <span className={styles.specKey}>NDWI (Water Index)</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      (B03 - B08) / (B03 + B08)
                    </div>
                  </div>
                  <Badge variant="emerald">OPERATIONAL</Badge>
                </div>

                <div className={styles.specItem}>
                  <div>
                    <span className={styles.specKey}>NBR (Burn Ratio)</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      (B08 - B12) / (B08 + B12)
                    </div>
                  </div>
                  <Badge variant="emerald">OPERATIONAL</Badge>
                </div>

                <div className={styles.specItem}>
                  <div>
                    <span className={styles.specKey}>Neural Threat Segmentation</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      Deep learning model weights
                    </div>
                  </div>
                  <Badge variant="outline">NOT AVAILABLE (ROADMAP)</Badge>
                </div>

                {pipelineInfo?.note && (
                  <p className={styles.specNote}>{pipelineInfo.note}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ── Environment Configuration Reference ── */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Platform Configuration Reference</CardTitle>
            <CardDescription>Backend environment variables and active endpoints.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.configTable}>
              <div className={styles.configRow}>
                <span className={styles.configKey}>API Base URL</span>
                <span className={styles.configValMono}>{API_BASE_URL}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Interactive Swagger UI</span>
                <a
                  href={`${API_BASE_URL}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.configLink}
                >
                  {API_BASE_URL}/docs ↗
                </a>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>OpenAPI Specification</span>
                <a
                  href={`${API_BASE_URL}/openapi.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.configLink}
                >
                  {API_BASE_URL}/openapi.json ↗
                </a>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Image Storage Location</span>
                <span className={styles.configValMono}>backend/images/ (Local Disk)</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Database Engine</span>
                <span className={styles.configValMono}>SQLite (backend/app/orvix.db)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default Settings;
