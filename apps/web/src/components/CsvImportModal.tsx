import { useRef, useState } from "react";
import type { Account } from "../api/accounts.js";
import { importTransactions, type ImportTransactionRow } from "../api/transactions.js";

interface Props {
  accounts: Account[];
  onDone: (imported: number) => void;
  onCancel: () => void;
  dateFormat?: "MDY" | "DMY";
}

// Normalise a date string to YYYY-MM-DD.
// Accepts: YYYY-MM-DD, MM/DD/YYYY or DD/MM/YYYY depending on dateFormat preference.
function normaliseDate(raw: string, dateFormat: "MDY" | "DMY" = "MDY"): string | null {
  const iso = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const slashDate = iso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    let first = parseInt(slashDate[1]!, 10);
    let second = parseInt(slashDate[2]!, 10);
    const y = slashDate[3]!;
    // If first > 12 it must be a day — swap regardless of format preference.
    // Otherwise honour the user's date format setting.
    if (first > 12 || dateFormat === "DMY") {
      [first, second] = [second, first];
    }
    const month = first;
    const day = second;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(iso);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function parseAmount(credit: string, debit: string): number | null {
  const c = credit.replace(/[$,\s]/g, "").trim();
  const d = debit.replace(/[$,\s]/g, "").trim();
  if (c !== "") {
    const n = parseFloat(c);
    return isNaN(n) ? null : n;
  }
  if (d !== "") {
    const n = parseFloat(d);
    if (isNaN(n)) return null;
    // Some banks export debit amounts as negative values in the debit column.
    // Normalise: debits must always reduce the balance (negative).
    return n > 0 ? -n : n;
  }
  return null;
}

function parseSingleAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Minimal RFC 4180-aware CSV line splitter.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text: string, dateFormat: "MDY" | "DMY" = "MDY"): { rows: ImportTransactionRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { rows: [], errors: ["File appears empty or has no data rows."] };

  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const descIdx = header.indexOf("description");
  const creditIdx = header.indexOf("credit");
  const debitIdx = header.indexOf("debit");
  const amountIdx = header.indexOf("amount");

  const hasSeparateColumns = creditIdx !== -1 || debitIdx !== -1;
  const hasSingleAmount = amountIdx !== -1;

  if (dateIdx === -1 || descIdx === -1 || (!hasSeparateColumns && !hasSingleAmount)) {
    return {
      rows: [],
      errors: [
        "CSV must have Date, Description, and either an Amount column or Credit/Debit columns.",
      ],
    };
  }

  const rows: ImportTransactionRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const rawDate = cols[dateIdx]?.trim() ?? "";
    const rawDesc = cols[descIdx]?.trim() ?? "";

    const date = normaliseDate(rawDate, dateFormat);
    if (!date) {
      errors.push(`Row ${i + 1}: invalid date "${rawDate}"`);
      continue;
    }
    if (!rawDesc) {
      errors.push(`Row ${i + 1}: missing description`);
      continue;
    }

    let amount: number | null;
    if (hasSeparateColumns) {
      const rawCredit = creditIdx !== -1 ? (cols[creditIdx]?.trim() ?? "") : "";
      const rawDebit = debitIdx !== -1 ? (cols[debitIdx]?.trim() ?? "") : "";
      amount = parseAmount(rawCredit, rawDebit);
    } else {
      amount = parseSingleAmount(cols[amountIdx]?.trim() ?? "");
    }

    if (amount === null) {
      errors.push(`Row ${i + 1}: no valid credit or debit amount`);
      continue;
    }
    rows.push({ date, description: rawDesc, amount });
  }

  return { rows, errors };
}

export function CsvImportModal({ accounts, onDone, onCancel, dateFormat = "MDY" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [rows, setRows] = useState<ImportTransactionRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, errors } = parseCsv(text, dateFormat);
      setRows(parsed);
      setParseErrors(errors);
      setSubmitError(null);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!rows || rows.length === 0 || !accountId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await importTransactions(accountId, rows);
      onDone(res.imported);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const canImport = rows && rows.length > 0 && accountId && !submitting;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Import transactions from CSV</h2>

        <p style={styles.hint}>
          Expected columns: <strong>Date, Description, Amount</strong> (negative = debit) or{" "}
          <strong>Credit, Debit</strong> (Balance is ignored). Dates parsed as{" "}
          <strong>{dateFormat === "DMY" ? "DD/MM/YYYY" : "MM/DD/YYYY"}</strong>
          {" "}— change in Settings.
        </p>

        <label style={styles.label}>Account</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          style={styles.select}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <label style={styles.label}>CSV file</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          style={styles.fileInput}
        />

        {parseErrors.length > 0 && (
          <div style={styles.errorBox}>
            <strong>Parse issues ({parseErrors.length}):</strong>
            <ul style={styles.errorList}>
              {parseErrors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {parseErrors.length > 10 && <li>…and {parseErrors.length - 10} more</li>}
            </ul>
          </div>
        )}

        {rows !== null && (
          <div style={styles.preview}>
            {rows.length === 0 ? (
              <p style={styles.noRows}>No valid rows to import.</p>
            ) : (
              <p style={styles.previewCount}>
                Ready to import <strong>{rows.length}</strong> transaction
                {rows.length !== 1 ? "s" : ""}.
              </p>
            )}
          </div>
        )}

        {submitError && <p style={styles.submitError}>{submitError}</p>}

        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn} type="button" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleImport}
            style={{ ...styles.importBtn, opacity: canImport ? 1 : 0.5 }}
            type="button"
            disabled={!canImport}
          >
            {submitting ? "Importing…" : "Import"}
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
  select: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid var(--border-input)",
    borderRadius: "8px",
    fontSize: "0.9rem",
    marginBottom: "1rem",
    boxSizing: "border-box",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
  },
  fileInput: {
    display: "block",
    marginBottom: "1rem",
    fontSize: "0.875rem",
    color: "var(--text-primary)",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
    fontSize: "0.82rem",
    color: "#b91c1c",
  },
  errorList: {
    margin: "0.35rem 0 0 1rem",
    padding: 0,
  },
  preview: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
  },
  previewCount: {
    margin: 0,
    fontSize: "0.9rem",
    color: "#15803d",
  },
  noRows: {
    margin: 0,
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
  },
  submitError: {
    color: "#dc2626",
    fontSize: "0.875rem",
    marginBottom: "0.75rem",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  cancelBtn: {
    padding: "0.55rem 1.25rem",
    border: "1px solid var(--border-input)",
    borderRadius: "8px",
    background: "var(--bg-card)",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "var(--text-label)",
  },
  importBtn: {
    padding: "0.55rem 1.5rem",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
};
