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
        const coords = (e.coordinates || "").toLowerCase();
        return title.includes(q) || id.includes(q) || coords.includes(q);
      }
      return true;
    });
  }, [events, filter, search]);

  function handleExportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredEvents, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `orvix_disaster_intel_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Disaster Intelligence Directory</h1>
          <p className={styles.subtitle}>
            Comprehensive planetary event registry ingested directly from NASA Earth Observatory Natural Event Tracker.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
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
            Live Geospatial Map
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Tracked Incidents</span>
          <span className={styles.metricVal}>{counts.total}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>NASA EONET v3 Feed</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Active Wildfires</span>
          <span className={styles.metricVal} style={{ color: "var(--accent-amber)" }}>{counts.wildfires}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>IRWIN / InciWeb sources</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Severe Storms</span>
          <span className={styles.metricVal} style={{ color: "var(--accent-cyan)" }}>{counts.storms}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>JTWC / NHC bulletins</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search events by name, ID, or coordinates…"
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

      {/* Event Table */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState
          title="NASA EONET Ingestion Error"
          message={error}
          onRetry={loadData}
        />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title="No Matching Events Found"
          description="Try broadening your search criteria or resetting category filters."
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
                  <th className={styles.th}>Source Dossier</th>
                  <th className={styles.th}>Tasking</th>
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
                        {typeof evt.latitude === "number" && typeof evt.longitude === "number" && (
                          <button
                            className={styles.actionLink}
                            onClick={() =>
                              navigate(
                                `/explorer?lat=${evt.latitude}&lon=${evt.longitude}&type=${
                                  isWildfire ? "wildfire" : "storm"
                                }`
                              )
                            }
                            title="Task Sentinel-2 acquisition for this incident"
                          >
                            Inspect Scene →
                          </button>
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

