import styles from "./ErrorState.module.css";
import { Button } from "./Button";

export function ErrorState({
  title = "Failed to load data",
  error,
  onRetry,
  className = "",
}) {
  return (
    <div className={`${styles.error} ${className}`} role="alert">
      <div className={styles.iconWrapper}>
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className={styles.content}>
        <h4 className={styles.title}>{title}</h4>
        {error && <p className={styles.message}>{error}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

