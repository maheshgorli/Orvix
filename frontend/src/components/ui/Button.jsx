import styles from "./Button.module.css";
import { Spinner } from "./Spinner";

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  icon: Icon,
  ...props
}) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner size={size === "sm" ? "12px" : "14px"} color="currentColor" />
      ) : Icon ? (
        <span className={styles.icon}>{Icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

