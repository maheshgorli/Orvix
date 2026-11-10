import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { Badge } from "../ui/Badge";

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      {/* Branding Header */}
      <div className={styles.brandHeader}>
        <div className={styles.logoRow}>
          <div className={styles.logoBadge}>
            <svg
              className={styles.logoSvg}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="7" strokeDasharray="2 3" />
              <circle cx="12" cy="12" r="10" strokeOpacity="0.4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </div>
          <div>
            <div className={styles.brandName}>ORVIX</div>
            <div className={styles.brandSub}>EARTH INTELLIGENCE</div>
          </div>
        </div>
        <p className={styles.tagline}>Understand Earth. Predict Tomorrow.</p>
      </div>

      {/* Primary Navigation */}
      <nav className={styles.nav} aria-label="Main Navigation">
        <div className={styles.sectionLabel}>CORE PLATFORM</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
          }
        >
          <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
          }
        >
          <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeOpacity="0" />
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span>System Health &amp; Settings</span>
        </NavLink>

        <div className={styles.sectionLabel}>INTELLIGENCE MODULES</div>
        <div className={`${styles.navItem} ${styles.navItemDisabled}`}>
          <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          </svg>
          <span>Live Monitoring</span>
          <Badge variant="outline" className={styles.comingSoon}>Pending</Badge>
        </div>

        <div className={`${styles.navItem} ${styles.navItemDisabled}`}>
          <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span>Satellite Explorer</span>
          <Badge variant="outline" className={styles.comingSoon}>Pending</Badge>
        </div>

        <div className={`${styles.navItem} ${styles.navItemDisabled}`}>
          <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>Spectral AI Detection</span>
          <Badge variant="outline" className={styles.comingSoon}>Pending</Badge>
        </div>
      </nav>

      {/* Footer Info */}
      <div className={styles.sidebarFooter}>
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>Backend: 127.0.0.1:8000</span>
        </div>
        <div className={styles.versionText}>ORVIX CORE v1.0.0</div>
      </div>
    </aside>
  );
}

