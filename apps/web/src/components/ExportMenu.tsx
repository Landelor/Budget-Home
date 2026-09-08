import { useEffect, useRef, useState } from "react";
import { downloadExport, type ExportFormat } from "../api/exportData.js";
import { ApiError } from "../api/client.js";

// Small, self-contained "Export Data" control: a single button that opens a
// two-option dropdown (CSV bundle / JSON) and triggers a file download.
// Deliberately compact so it doesn't compete with the dashboard's summary
// cards and charts for visual attention.
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleExport(format: ExportFormat) {
    setOpen(false);
    setBusy(true);
    setError(null);
    try {
      await downloadExport(format);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <button
        type="button"
        style={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title="Export your data"
      >
        {busy ? "Exporting…" : "Export data ⬇"}
      </button>
      {open && (
        <div style={styles.dropdown}>
          <button type="button" style={styles.dropItem} onClick={() => handleExport("csv")}>
            <span style={styles.dropItemLabel}>CSV bundle</span>
            <span style={styles.dropItemHint}>.zip — one file per section</span>
          </button>
          <button type="button" style={styles.dropItem} onClick={() => handleExport("json")}>
            <span style={styles.dropItemLabel}>JSON</span>
            <span style={styles.dropItemHint}>.json — full raw data</span>
          </button>
        </div>
      )}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "0.75rem",
  },
  trigger: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    padding: "0.4rem 0.875rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "0.25rem",
    minWidth: "200px",
    zIndex: 200,
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  },
  dropItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    textAlign: "left",
  },
  dropItemLabel: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  dropItemHint: {
    fontSize: "0.7rem",
    color: "var(--text-secondary)",
  },
  error: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    margin: 0,
    fontSize: "0.75rem",
    color: "#dc2626",
    whiteSpace: "nowrap",
  },
};
