import styles from "./EmptyState.module.css";

export function EmptyState({
  title = "No data found",
  description,
  action,
  icon: Icon,
  className = "",
}) {
  return (
    <div className={`${styles.empty} ${className}`}>
      <div className={styles.iconWrapper}>
        {Icon ? (
          Icon
        ) : (
          <svg
            className={styles.defaultIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
      <h4 className={styles.title}>{title}</h4>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

