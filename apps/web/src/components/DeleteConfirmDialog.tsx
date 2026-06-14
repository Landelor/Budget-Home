import { useState } from "react";

interface Props {
  name: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ name, onConfirm, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Delete account?</h2>
        <p style={styles.body}>
          Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.
        </p>
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn} disabled={loading} type="button">
            Cancel
          </button>
          <button onClick={handleConfirm} style={styles.deleteBtn} disabled={loading} type="button">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: "1rem",
  },
  modal: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "1.75rem",
    width: "100%",
    maxWidth: "380px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
  },
  title: {
    margin: "0 0 0.75rem",
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  body: {
    margin: "0 0 1rem",
    color: "var(--text-secondary)",
    fontSize: "0.95rem",
    lineHeight: 1.5,
  },
  error: {
    color: "#dc2626",
    fontSize: "0.875rem",
    margin: "0 0 1rem",
    background: "#fef2f2",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
  },
  actions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
  },
  cancelBtn: {
    padding: "0.625rem 1.25rem",
    border: "1px solid var(--border-input)",
    borderRadius: "8px",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "var(--text-label)",
  },
  deleteBtn: {
    padding: "0.625rem 1.25rem",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
};
