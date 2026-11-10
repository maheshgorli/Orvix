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
  const [tokenError, setTokenError] = useState(null);
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
        setTokenError(null);
      } catch (tErr) {
        setTokenInfo(null);
        setTokenError(tErr.message);
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
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>System Health &amp; Settings</h1>
          <p className={styles.pageSub}>
            Real-time diagnostics, integration connectivity, and platform configuration.
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
          error={error}
          onRetry={loadHealthData}
          className={styles.banner}
        />
      )}

      {/* Services Grid */}
      <section>
        <div className={styles.sectionHeading}>INTEGRATED SUBSYSTEMS</div>
        {loading ? (
          <div className={styles.loadingRow}>
            <Spinner size="24px" color="var(--accent-cyan)" />
            <span>Probing subsystem endpoints...</span>
          </div>
        ) : (
          <div className={styles.servicesGrid}>
            {services.map((svc) => (
              <Card key={svc.name} hover>
                <CardHeader className={styles.serviceHeader}>
                  <div className={styles.serviceTitleRow}>
                    <CardTitle>{svc.name}</CardTitle>
                    <Badge variant={svc.reachable ? "green" : "red"} dot>
                      {svc.reachable ? "OPERATIONAL" : "DEGRADED"}
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

      {/* Two Column Grid: OAuth & Pipeline Specs */}
      <div className={styles.twoColumnGrid}>
        {/* Copernicus OAuth Token */}
        <section className={styles.col}>
          <Card>
            <CardHeader>
              <div className={styles.cardHeaderFlex}>
                <CardTitle>Copernicus OAuth2 Token Status</CardTitle>
                <Badge variant={tokenInfo ? "green" : "orange"}>
                  {tokenInfo ? "ACTIVE" : "UNAUTHENTICATED"}
                </Badge>
              </div>
              <CardDescription>
                Sentinel Hub Copernicus Data Space Ecosystem (CDSE) credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokenInfo ? (
                <div className={styles.tokenDataGrid}>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Access Token:</span>
                    <span className={styles.fieldValueMono}>
                      {tokenInfo.access_token}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Token Type:</span>
                    <span className={styles.fieldValue}>{tokenInfo.token_type}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Expires In:</span>
                    <span className={styles.fieldValueMono}>{tokenInfo.expires_in} s</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>Seconds Remaining:</span>
                    <span className={`${styles.fieldValueMono} ${styles.greenText}`}>
                      {tokenInfo.seconds_remaining} s
                    </span>
                  </div>
                  <div className={styles.securityNotice}>
                    Secret keys (client_secret) are stored in .env and strictly never exposed to the client.
                  </div>
                </div>
              ) : (
                <div className={styles.tokenNotice}>
                  <p className={styles.noticeText}>
                    {tokenError ||
                      "Copernicus OAuth credentials are not configured or invalid. The platform boots normally without credentials."}
                  </p>
                  <p className={styles.noticeSub}>
                    To enable Sentinel-2 imagery downloads, obtain a Client ID &amp; Secret from Copernicus Data Space Ecosystem and configure them in backend/.env.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* AI Analysis Pipeline Specs */}
        <section className={styles.col}>
          <Card>
            <CardHeader>
              <div className={styles.cardHeaderFlex}>
                <CardTitle>AI Analysis Specifications</CardTitle>
                <Badge variant="cyan">STATUS: PENDING</Badge>
              </div>
              <CardDescription>
                Spectral and computer vision processing module readiness.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineInfo ? (
                <div className={styles.specsList}>
                  <div className={styles.specItem}>
                    <span className={styles.specKey}>Validation Engine:</span>
                    <Badge variant="outline">{pipelineInfo.stages?.validation || "pending"}</Badge>
                  </div>
                  <div className={styles.specItem}>
                    <span className={styles.specKey}>Radiometric Preprocessor:</span>
                    <Badge variant="outline">{pipelineInfo.stages?.preprocessing || "pending"}</Badge>
                  </div>
                  <div className={styles.specItem}>
                    <span className={styles.specKey}>NDVI (Vegetation Index):</span>
                    <Badge variant="outline">
                      {pipelineInfo.stages?.spectral_indices?.ndvi || "pending"}
                    </Badge>
                  </div>
                  <div className={styles.specItem}>
                    <span className={styles.specKey}>NBR (Burn Ratio):</span>
                    <Badge variant="outline">
                      {pipelineInfo.stages?.spectral_indices?.nbr || "pending"}
                    </Badge>
                  </div>
                  <div className={styles.specItem}>
                    <span className={styles.specKey}>Neural Detection Model:</span>
                    <Badge variant="outline">{pipelineInfo.stages?.model || "pending"}</Badge>
                  </div>
                  <p className={styles.specNote}>{pipelineInfo.note}</p>
                </div>
              ) : (
                <div className={styles.loadingRow}>
                  <Spinner size="18px" />
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Environment Configuration */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Platform Configuration Reference</CardTitle>
            <CardDescription>Environment variables and active endpoints.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.configTable}>
              <div className={styles.configRow}>
                <span className={styles.configKey}>API Base URL</span>
                <span className={styles.configValMono}>{API_BASE_URL}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Interactive Documentation</span>
                <a
                  href={`${API_BASE_URL}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.configLink}
                >
                  {API_BASE_URL}/docs
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
                  {API_BASE_URL}/openapi.json
                </a>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Image Storage Location</span>
                <span className={styles.configValMono}>backend/images/ (Local Disk)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

