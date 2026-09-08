import { useRef, useState } from "react";
import { importData, type ImportResult } from "../api/exportData.js";
import { ApiError } from "../api/client.js";

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  accounts: "Accounts",
  transactions: "Transactions",
  categories: "Categories",
  budgets: "Budgets",
  expenses: "Expenses",
  incomePersons: "Income persons",
  incomes: "Income entries",
  utilities: "Utility bills",
  netWorthEntries: "Net worth entries",
  offsetItems: "Offset items",
};

function countRows(payload: Record<string, unknown>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of Object.keys(SECTION_LABELS)) {
    const value = payload[key];
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  return counts;
}

// Modal for importing a previously-exported JSON file back into the app.
// Two-step flow: parse + show a per-section row count preview, then an
// explicit confirm click actually writes the data (as new records — nothing
// existing is ever overwritten).
export function ImportModal({ onDone, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPayload(null);
    setCounts(null);
    setParseError(null);
    setSubmitError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setParseError("File does not look like a Budget-Home export (expected a JSON object).");
          return;
        }
        const obj = parsed as Record<string, unknown>;
        const rowCounts = countRows(obj);
        const total = Object.values(rowCounts).reduce((a, b) => a + b, 0);
        if (total === 0) {
          setParseError("No recognisable data found in this file.");
          return;
        }
        setPayload(obj);
        setCounts(rowCounts);
      } catch {
        setParseError("Could not parse this file as JSON.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!payload) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await importData(payload);
      setResult(res);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Import failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const previewEntries = counts
    ? Object.entries(counts).filter(([, n]) => n > 0)
    : [];

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Import data</h2>

        {!result && (
          <>
            <p style={styles.hint}>
              Select a JSON file previously downloaded from <strong>Export data → JSON</strong>.
              Imported rows are always added as new entries — nothing existing is changed or
              removed.
            </p>

            <label style={styles.label}>JSON file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={styles.fileInput}
            />

            {parseError && <p style={styles.errorText}>{parseError}</p>}

            {previewEntries.length > 0 && (
              <div style={styles.preview}>
                <p style={styles.previewTitle}>Ready to import:</p>
                <ul style={styles.previewList}>
                  {previewEntries.map(([key, n]) => (
                    <li key={key} style={styles.previewItem}>
                      <span>{SECTION_LABELS[key] ?? key}</span>
                      <strong>{n}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {submitError && <p style={styles.errorText}>{submitError}</p>}

            <div style={styles.actions}>
              <button onClick={onCancel} style={styles.cancelBtn} type="button" disabled={submitting}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                style={{ ...styles.importBtn, opacity: payload && !submitting ? 1 : 0.5 }}
                type="button"
                disabled={!payload || submitting}
              >
                {submitting ? "Importing…" : "Import"}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <p style={styles.hint}>
              Imported <strong>{result.totalImported}</strong> record
              {result.totalImported !== 1 ? "s" : ""}
              {result.totalSkipped > 0 && (
                <>
                  {" "}
                  — <strong>{result.totalSkipped}</strong> row
                  {result.totalSkipped !== 1 ? "s" : ""} skipped
                </>
              )}
              .
            </p>

            <div style={styles.preview}>
              <ul style={styles.previewList}>
                {Object.entries(result.sections)
                  .filter(([, s]) => s.imported > 0 || s.skipped > 0)
                  .map(([key, s]) => (
                    <li key={key} style={styles.previewItem}>
                      <span>{SECTION_LABELS[key] ?? key}</span>
                      <span>
                        {s.imported} imported{s.skipped > 0 ? `, ${s.skipped} skipped` : ""}
                      </span>
                    </li>
                  ))}
              </ul>
              {Object.values(result.sections).some((s) => s.errors.length > 0) && (
                <details style={styles.details}>
                  <summary>Skipped row details</summary>
                  <ul style={styles.errorList}>
                    {Object.entries(result.sections).flatMap(([key, s]) =>
                      s.errors.map((err, i) => (
                        <li key={`${key}-${i}`}>
                          {SECTION_LABELS[key] ?? key}: {err}
                        </li>
                      )),
                    )}
                  </ul>
                </details>
              )}
            </div>

            <div style={styles.actions}>
              <button onClick={onDone} style={styles.importBtn} type="button">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "2rem",
    width: "100%",
    maxWidth: "480px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  },
  title: {
    margin: "0 0 0.5rem",
    fontSize: "1.2rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  hint: {
    margin: "0 0 1.25rem",
    fontSize: "0.85rem",
    color: "var(--text-secondary)",
  },
  label: {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--text-label)",
    marginBottom: "0.35rem",
  },
  fileInput: {
    display: "block",
    marginBottom: "1rem",
    fontSize: "0.875rem",
    color: "var(--text-primary)",
  },
  preview: {
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
  },
  previewTitle: {
    margin: "0 0 0.5rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  previewList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  previewItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.85rem",
    color: "var(--text-primary)",
  },
  details: {
    marginTop: "0.75rem",
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
  },
  errorList: {
    margin: "0.5rem 0 0",
    paddingLeft: "1.1rem",
  },
  errorText: {
    fontSize: "0.8rem",
    color: "#dc2626",
    margin: "0 0 1rem",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  importBtn: {
    background: "#2563eb",
    border: "none",
    color: "#fff",
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
};
