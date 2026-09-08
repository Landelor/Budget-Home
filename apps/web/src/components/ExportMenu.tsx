import { useEffect, useRef, useState } from "react";
import { downloadExport, type ExportFormat } from "../api/exportData.js";
import { ApiError } from "../api/client.js";
import { ImportModal } from "./ImportModal.js";

// Small, self-contained "Export data" control: a single button that opens a
// compact dropdown (CSV bundle / JSON export, plus an import option) and
// triggers a file download or opens the import modal. Deliberately compact
// so it doesn't compete with the dashboard's summary cards and charts.
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
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
        title="Export or import your data"
      >
        {busy ? "Exporting…" : "Export / Import ⬇"}
      </button>
      {open && (
        <div style={styles.dropdown}>
          <p style={styles.dropSectionLabel}>Export</p>
          <button type="button" style={styles.dropItem} onClick={() => handleExport("csv")}>
            <span style={styles.dropItemLabel}>CSV bundle</span>
            <span style={styles.dropItemHint}>.zip — one file per section</span>
          </button>
          <button type="button" style={styles.dropItem} onClick={() => handleExport("json")}>
            <span style={styles.dropItemLabel}>JSON</span>
            <span style={styles.dropItemHint}>.json — full raw data</span>
          </button>
          <div style={styles.dropDivider} />
          <p style={styles.dropSectionLabel}>Import</p>
          <button
            type="button"
            style={styles.dropItem}
            onClick={() => {
              setOpen(false);
              setImportOpen(true);
            }}
          >
            <span style={styles.dropItemLabel}>From JSON export</span>
            <span style={styles.dropItemHint}>merges as new records</span>
          </button>
        </div>
      )}
      {error && <p style={styles.error}>{error}</p>}
      {importOpen && (
        <ImportModal
          onCancel={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            // Reload so every page/hook picks up the newly imported data.
            window.location.reload();
          }}
        />
      )}
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
    minWidth: "210px",
    zIndex: 200,
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  },
  dropSectionLabel: {
    margin: "0.35rem 0.75rem 0.15rem",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
  },
  dropDivider: {
    height: "1px",
    background: "var(--border)",
    margin: "0.25rem 0",
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
