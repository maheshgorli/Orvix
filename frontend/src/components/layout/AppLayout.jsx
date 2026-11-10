import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import styles from "./AppLayout.module.css";
import { Badge } from "../ui/Badge";

export function AppLayout({ children }) {
  const [utcTime, setUtcTime] = useState("");

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
      <Sidebar />
      <div className={styles.mainWrapper}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.missionPill}>MISSION CONTROL</span>
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

