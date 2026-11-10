import styles from "./Badge.module.css";

export function Badge({
  children,
  variant = "default",
  dot = false,
  className = "",
  ...props
}) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`} {...props}>
      {dot && <span className={styles.dot} />}
      <span>{children}</span>
    </span>
  );
}

