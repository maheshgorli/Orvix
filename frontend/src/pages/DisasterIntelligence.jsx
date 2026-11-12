import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./DisasterIntelligence.module.css";
import { Badge, Spinner, Button, EmptyState, ErrorState } from "../components/ui";
import { getDisasters } from "../services/api";

export function DisasterIntelligence() {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await getDisasters({ days: 60 });
      setEvents(res?.events || []);
    } catch (err) {
      setError(err.message || "Failed to query NASA EONET disaster telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await getDisasters({ days: 60 });
        if (!ignore) {
          setEvents(res?.events || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to query NASA EONET disaster telemetry.");
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

  const counts = useMemo(() => {
    const wf = events.filter((e) => e.category_id === "wildfires").length;
    const st = events.filter((e) => e.category_id === "severeStorms").length;
    return { total: events.length, wildfires: wf, storms: st };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filter === "wildfires" && e.category_id !== "wildfires") return false;
      if (filter === "severeStorms" && e.category_id !== "severeStorms") return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const title = (e.title || "").toLowerCase();
        const id = (e.event_id || "").toLowerCase();
        const coords = Array.isArray(e.coordinates) ? e.coordinates.join(", ") : String(e.coordinates || "");
        return title.includes(q) || id.includes(q) || coords.toLowerCase().includes(q);
      }
      return true;
    });
  }, [events, filter, search]);

  function handleExportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredEvents, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `orvix_disaster_insights_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Disaster Insights</h1>
          <p className={styles.subtitle}>
            Comprehensive planetary event registry ingested directly from NASA Earth Observatory Natural Event Tracker (EONET v3).
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Button variant="outline" onClick={handleExportJSON} disabled={filteredEvents.length === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export JSON
          </Button>
          <Button variant="primary" onClick={() => navigate("/monitoring")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            </svg>
            View Disaster Map
          </Button>
        </div>
      </div>

      {/* ── Educational Explainer Banner ── */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            backgroundColor: "rgba(6, 182, 212, 0.12)",
            color: "var(--accent-cyan)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div style={{ fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text-main)", display: "block", marginBottom: "2px" }}>
            Factual Observational Data, Not AI Predictions
          </strong>
          Every event listed below represents a verified physical disaster catalogued by NASA EONET in partnership with global monitoring agencies (InciWeb, IRWIN, Joint Typhoon Warning Center, and National Hurricane Center). Click <strong>Explore This Location from Space</strong> to immediately acquire fresh Sentinel-2 or Landsat satellite imagery over any event.
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Tracked Incidents</span>
          <span className={styles.metricVal}>{counts.total}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>NASA EONET v3 Feed (Past 60 Days)</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Active Wildfires</span>
          <span className={styles.metricVal} style={{ color: "var(--accent-amber)" }}>{counts.wildfires}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>IRWIN / InciWeb Ground &amp; Satellite Reports</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Severe Storms</span>
          <span className={styles.metricVal} style={{ color: "var(--accent-cyan)" }}>{counts.storms}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>JTWC / NHC Tropical Cyclones &amp; Typhoons</span>
        </div>
      </div>

      {/* ── Toolbar: Search & Filters ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search events by title, ID, or coordinates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${filter === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter("all")}
          >
            All Events ({counts.total})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "wildfires" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter("wildfires")}
          >
            Wildfires ({counts.wildfires})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "severeStorms" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter("severeStorms")}
          >
            Severe Storms ({counts.storms})
          </button>
        </div>
      </div>

      {/* ── Event Table ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState
          title="NASA EONET Ingestion Notice"
          message={error}
          onRetry={loadData}
        />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title="No Matching Events Found"
          description="Try broadening your search criteria or resetting the category filters."
        />
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Event ID</th>
                  <th className={styles.th}>Category</th>
                  <th className={styles.th}>Incident Title</th>
                  <th className={styles.th}>Coordinates (Lat, Lon)</th>
                  <th className={styles.th}>Detection Date</th>
                  <th className={styles.th}>NASA Source</th>
                  <th className={styles.th}>Satellite Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((evt) => {
                  const isWildfire = evt.category_id === "wildfires";
                  return (
                    <tr key={evt.event_id} className={styles.tr}>
                      <td className={`${styles.td} mono`} style={{ fontSize: "0.78rem" }}>
                        {evt.event_id}
                      </td>
                      <td className={styles.td}>
                        <Badge variant={isWildfire ? "amber" : "cyan"}>
                          {isWildfire ? "Wildfire" : "Severe Storm"}
                        </Badge>
                      </td>
                      <td className={styles.td} style={{ fontWeight: 500, maxWidth: "300px" }}>
                        {evt.title}
                      </td>
                      <td className={`${styles.td} mono`} style={{ fontSize: "0.78rem" }}>
                        {typeof evt.latitude === "number" && typeof evt.longitude === "number"
                          ? `${evt.latitude.toFixed(4)}, ${evt.longitude.toFixed(4)}`
                          : evt.coordinates || "N/A"}
                      </td>
                      <td className={styles.td} style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {evt.date ? new Date(evt.date).toLocaleDateString() : "Unknown"}
                      </td>
                      <td className={styles.td}>
                        {evt.source_url ? (
                          <a
                            href={evt.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.actionLink}
                          >
                            NASA Dossier ↗
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>None</span>
                        )}
                      </td>
                      <td className={styles.td}>
                        {typeof evt.latitude === "number" && typeof evt.longitude === "number" ? (
                          <button
                            className={styles.actionLink}
                            onClick={() =>
                              navigate(
                                `/explorer?lat=${evt.latitude}&lon=${evt.longitude}&type=${
                                  isWildfire ? "wildfire" : "storm"
                                }`
                              )
                            }
                            title="Acquire satellite imagery for this incident"
                            style={{
                              background: "rgba(6, 182, 212, 0.08)",
                              border: "1px solid rgba(6, 182, 212, 0.25)",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              cursor: "pointer",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            Explore from Space
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>No Coordinates</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DisasterIntelligence;
