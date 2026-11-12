import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import styles from "./AppLayout.module.css";
import { Badge } from "../ui/Badge";

export function AppLayout({ children }) {
  const [utcTime, setUtcTime] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [prevPath, setPrevPath] = useState(location.pathname);

  // Close mobile drawer when route changes (render-phase state adjustment)
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
  }

  // Live UTC system clock
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setUtcTime(now.toUTCString().replace("GMT", "UTC"));
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className={styles.mainWrapper}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            {/* Hamburger button for mobile/tablet */}
            <button
              className={styles.hamburgerBtn}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation drawer"
              title="Open Navigation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className={styles.missionPill}>ORVIX MISSION CONTROL</span>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.clockRow}>
              <span className={styles.clockLabel}>SYSTEM TIME</span>
              <span className={styles.clockValue}>{utcTime || "SYNCHRONIZING..."}</span>
            </div>
            <div className={styles.divider} />
            <Badge variant="cyan" dot>
              ONLINE
            </Badge>
          </div>
        </header>
        <main className={styles.contentArea}>{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;
