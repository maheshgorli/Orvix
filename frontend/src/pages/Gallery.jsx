import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Gallery.module.css";
import { Badge, Spinner, Button, EmptyState, ErrorState } from "../components/ui";
import { getGallery, deleteImage, getDownloadUrl, API_BASE_URL } from "../services/api";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function Gallery() {
  const navigate = useNavigate();

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [deletingId, setDeletingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchImages = useCallback(async () => {
    setError(null);
    try {
      const res = await getGallery();
      const list = Array.isArray(res) ? res : res?.images || [];
      setImages(list);
    } catch (err) {
      setError(err.message || "Failed to query satellite imagery gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await getGallery();
        if (!ignore) {
          const list = Array.isArray(res) ? res : res?.images || [];
          setImages(list);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to query satellite imagery gallery.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleDelete(filename) {
    if (!window.confirm(`Are you sure you want to permanently delete '${filename}'?`)) {
      return;
    }
    setDeletingId(filename);
    try {
      await deleteImage(filename);
      setImages((prev) => prev.filter((img) => img.filename !== filename));
      setStatusMessage({ type: "success", text: `Deleted '${filename}' from disk archive.` });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Deletion failed: ${err.message}` });
    } finally {
      setDeletingId(null);
    }
  }

  // Filter & Search
  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      // Type filter
      if (filterType !== "all") {
        const normType = (img.disaster_type || "").toLowerCase();
        if (filterType === "wildfire" && !normType.includes("wildfire")) return false;
        if (filterType === "storm" && !normType.includes("storm")) return false;
        if (filterType === "satellite" && !normType.includes("satellite")) return false;
      }
      // Search text
      if (search.trim()) {
        const q = search.toLowerCase();
        const fname = (img.filename || "").toLowerCase();
        const loc = (img.location || "").toLowerCase();
        const date = (img.date || "").toLowerCase();
        return fname.includes(q) || loc.includes(q) || date.includes(q);
      }
      return true;
    });
  }, [images, filterType, search]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Satellite Imagery Archive</h1>
          <p className={styles.subtitle}>
            Verified satellite acquisitions and multispectral composites preserved on local storage.
          </p>
        </div>

        <Button variant="primary" onClick={() => navigate("/explorer")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Acquire New Scene
        </Button>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              statusMessage.type === "success"
                ? "var(--accent-green-dim)"
                : "var(--accent-red-dim)",
            border:
              statusMessage.type === "success"
                ? "1px solid var(--accent-green)"
                : "1px solid var(--accent-red)",
            color: statusMessage.type === "success" ? "var(--accent-green)" : "#fca5a5",
          }}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{ color: "inherit", cursor: "pointer", background: "none", border: "none" }}
          >
            ×
          </button>
        </div>
      )}

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
            placeholder="Search by filename, date, coordinates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${filterType === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterType("all")}
          >
            All ({images.length})
          </button>
          <button
            className={`${styles.filterBtn} ${filterType === "wildfire" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterType("wildfire")}
          >
            Wildfires
          </button>
          <button
            className={`${styles.filterBtn} ${filterType === "storm" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterType("storm")}
          >
            Severe Storms
          </button>
          <button
            className={`${styles.filterBtn} ${filterType === "satellite" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterType("satellite")}
          >
            Tasked Scenes
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState
          title="Archive Retrieval Error"
          message={error}
          onRetry={fetchImages}
        />
      ) : filteredImages.length === 0 ? (
        <EmptyState
          title="No Images Found"
          description={
            images.length === 0
              ? "No satellite imagery has been acquired or saved to disk yet."
              : "No imagery matches the current filter or search criteria."
          }
          actionLabel="Acquire Sentinel-2 Scene"
          onAction={() => navigate("/explorer")}
        />
      ) : (
        <div className={styles.grid}>
          {filteredImages.map((img) => {
            const isWildfire = (img.disaster_type || "").toLowerCase().includes("wildfire");
            const isStorm = (img.disaster_type || "").toLowerCase().includes("storm");
            const badgeVariant = isWildfire ? "amber" : isStorm ? "cyan" : "teal";

            const imageUrl = img.image_url || `${API_BASE_URL}/${img.image_path}`;

            return (
              <div key={img.filename} className={styles.card}>
                <div className={styles.imageFrame}>
                  <img
                    src={imageUrl}
                    alt={img.filename}
                    className={styles.image}
                    loading="lazy"
                  />
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <Badge variant={badgeVariant}>{img.disaster_type || "Satellite"}</Badge>
                    <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      {formatBytes(img.file_size_bytes)}
                    </span>
                  </div>

                  <div className={styles.filename} title={img.filename}>
                    {img.filename}
                  </div>

                  <div className={styles.metaRow}>
                    <div className="mono">
                      Location: {img.location || (img.latitude != null ? `Lat ${img.latitude.toFixed(4)}, Lon ${img.longitude.toFixed(4)}` : "Coordinate Grid")}
                    </div>
                    <div>
                      Observed: {img.date || (img.captured_at ? new Date(img.captured_at).toUTCString() : "Timestamped")}
                    </div>
                    <div style={{ color: "var(--text-dim)" }}>
                      Source: {img.data_collection ? img.data_collection.toUpperCase() : "Sentinel-2 L2A"}
                    </div>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(img.filename)}
                    disabled={deletingId === img.filename}
                  >
                    {deletingId === img.filename ? "Deleting…" : "Delete"}
                  </button>

                  <div className={styles.actionBtns}>
                    {img.latitude != null && img.longitude != null && (
                      <button
                        className={styles.downloadLink}
                        onClick={() => navigate(`/explorer?lat=${img.latitude}&lon=${img.longitude}`)}
                        title="Open target coordinates in Explorer"
                      >
                        Inspect
                      </button>
                    )}
                    <a
                      href={getDownloadUrl(img.filename)}
                      download={img.filename}
                      className={styles.downloadLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default Gallery;
