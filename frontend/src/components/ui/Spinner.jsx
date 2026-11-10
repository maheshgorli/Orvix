import styles from "./Spinner.module.css";

export function Spinner({ size = "20px", color = "currentColor", className = "" }) {
  return (
    <span
      className={`${styles.spinner} ${className}`}
      style={{ width: size, height: size, color }}
      role="status"
      aria-label="Loading"
    >
      <svg className={styles.svg} viewBox="0 0 24 24" fill="none">
        <circle
          className={styles.track}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className={styles.head}
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </span>
  );
}

