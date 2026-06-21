import { useState, useEffect, useMemo } from "react";
import { NavBar } from "../components/NavBar.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";
import { useNetWorth } from "../hooks/useNetWorth.js";
import type { NetWorthEntry, NetWorthSection, NetWorthType } from "../api/netWorth.js";
import { getSettings } from "../api/settings.js";

const ASSET_TYPES: NetWorthType[] = ["property", "shares", "bank_account", "super"];
const LIABILITY_TYPES: NetWorthType[] = ["loan"];

const TYPE_LABELS: Record<NetWorthType, string> = {
  property: "Property",
  shares: "Shares",
  bank_account: "Bank Account",
  super: "Super",
  loan: "Loan",
};

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function currentMonthInput(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthInputToApi(value: string): string {
  return `${value}-01`;
}

function apiMonthToInput(value: string): string {
  return value.slice(0, 7);
}

function formatMonthLabel(monthDate: string): string {
  const [year, month] = monthDate.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

interface FormState {
  type: NetWorthType;
  description: string;
  amount: string;
  month: string;
}

export function NetWorthPage({ onLogout, onNavigate }: Props) {
  const { entries, summary, loading, error, add, edit, remove } = useNetWorth();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthInput());
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  const [formSection, setFormSection] = useState<NetWorthSection>("asset");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({ type: "property", description: "", amount: "", month: currentMonthInput() });
  const [editing, setEditing] = useState<NetWorthEntry | null>(null);
  const [deleting, setDeleting] = useState<NetWorthEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => setDefaultCurrency(s.defaultCurrency))
      .catch(() => {});
  }, []);

  const monthApi = monthInputToApi(selectedMonth);
  const monthEntries = entries.filter((e) => e.month === monthApi);
  const assetEntries = monthEntries.filter((e) => e.section === "asset");
  const liabilityEntries = monthEntries.filter((e) => e.section === "liability");

  const monthSummary = summary.find((s) => s.month === monthApi);
  const totalAssets = monthSummary ? parseFloat(monthSummary.totalAssets) : 0;
  const totalLiabilities = monthSummary ? parseFloat(monthSummary.totalLiabilities) : 0;
  const netPosition = monthSummary ? parseFloat(monthSummary.netPosition) : totalAssets - totalLiabilities;

  const previousMonthWithEntries = useMemo(() => {
    const months = Array.from(new Set(entries.map((e) => e.month))).filter((m) => m < monthApi);
    if (months.length === 0) return null;
    return months.sort().at(-1) ?? null;
  }, [entries, monthApi]);

  const sortedSummary = useMemo(() => [...summary].sort((a, b) => b.month.localeCompare(a.month)), [summary]);

  function openAdd(section: NetWorthSection) {
    setFormSection(section);
    setEditing(null);
    setForm({
      type: section === "asset" ? "property" : "loan",
      description: "",
      amount: "",
      month: selectedMonth,
    });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(entry: NetWorthEntry) {
    setFormSection(entry.section);
    setEditing(entry);
    setForm({
      type: entry.type,
      description: entry.description,
      amount: parseFloat(entry.amount).toString(),
      month: apiMonthToInput(entry.month),
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.description.trim()) { setFormError("Description is required."); return; }
    if (isNaN(amount) || amount < 0) { setFormError("Amount must be a non-negative number."); return; }
    if (!form.month) { setFormError("Month is required."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const monthValue = monthInputToApi(form.month);
      if (editing) {
        await edit(editing.id, form.type, form.description.trim(), amount, monthValue);
      } else {
        await add(form.type, form.description.trim(), amount, monthValue);
      }
      closeForm();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entry: NetWorthEntry) {
    await remove(entry.id);
    setDeleting(null);
  }

  async function handleCopyFromPreviousMonth() {
    if (!previousMonthWithEntries) return;
    setCopying(true);
    try {
      const toCopy = entries.filter((e) => e.month === previousMonthWithEntries);
      for (const entry of toCopy) {
        await add(entry.type, entry.description, parseFloat(entry.amount), monthApi);
      }
    } finally {
      setCopying(false);
    }
  }

  function renderSection(section: NetWorthSection, title: string, sectionEntries: NetWorthEntry[], total: number) {
    return (
      <div style={styles.tableSection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>{title}</h3>
          <button style={styles.addBtn} type="button" onClick={() => openAdd(section)}>+ Add {title === "Assets" ? "Asset" : "Liability"}</button>
        </div>

        {sectionEntries.length === 0 && (
          <p style={styles.emptyMsg}>No {title.toLowerCase()} recorded for {formatMonthLabel(monthApi)} yet.</p>
        )}

        {sectionEntries.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Description</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sectionEntries.map((entry) => (
                  <tr key={entry.id} style={styles.tr}>
                    <td style={styles.td}>{TYPE_LABELS[entry.type]}</td>
                    <td style={styles.td}>{entry.description}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmt(parseFloat(entry.amount), defaultCurrency)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.actionBtn} type="button" onClick={() => openEdit(entry)}>Edit</button>
                      <button
                        style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                        type="button"
                        onClick={() => setDeleting(entry)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={styles.totalLabel} colSpan={2}>Total</td>
                  <td style={{ ...styles.totalValue, textAlign: "right" }}>{fmt(total, defaultCurrency)}</td>
                  <td style={styles.td} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <NavBar onLogout={onLogout} onNavigate={onNavigate} activePage="networth" />

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <h2 style={styles.pageTitle}>Net Worth</h2>
          <label style={styles.monthPicker}>
            Month
            <input
              style={styles.monthInput}
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </label>
        </div>

        {loading && <p style={styles.status}>Loading…</p>}
        {error && <p style={styles.errorMsg}>{error}</p>}

        {!loading && (
          <>
            {monthEntries.length === 0 && previousMonthWithEntries && (
              <div style={styles.copyBanner}>
                <span>No entries for {formatMonthLabel(monthApi)} yet. Carry forward {formatMonthLabel(previousMonthWithEntries)}'s entries to update them for this month.</span>
                <button style={styles.copyBtn} type="button" disabled={copying} onClick={handleCopyFromPreviousMonth}>
                  {copying ? "Copying…" : "Copy from previous month"}
                </button>
              </div>
            )}

            <div style={styles.netPositionCard}>
              <div style={styles.netPositionItem}>
                <span style={styles.netPositionLabel}>Total Assets</span>
                <span style={styles.netPositionValue}>{fmt(totalAssets, defaultCurrency)}</span>
              </div>
              <div style={styles.netPositionItem}>
                <span style={styles.netPositionLabel}>Total Liabilities</span>
                <span style={styles.netPositionValue}>{fmt(totalLiabilities, defaultCurrency)}</span>
              </div>
              <div style={styles.netPositionItem}>
                <span style={styles.netPositionLabel}>Net Position</span>
                <span style={{ ...styles.netPositionValue, color: netPosition >= 0 ? "#16a34a" : "#dc2626" }}>
                  {fmt(netPosition, defaultCurrency)}
                </span>
              </div>
            </div>

            {renderSection("asset", "Assets", assetEntries, totalAssets)}
            {renderSection("liability", "Liabilities", liabilityEntries, totalLiabilities)}

            <div style={styles.tableSection}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>History</h3>
              </div>
              {sortedSummary.length === 0 && (
                <p style={styles.emptyMsg}>No history yet — add entries to start tracking your net worth over time.</p>
              )}
              {sortedSummary.length > 0 && (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Month</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>Assets</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>Liabilities</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>Net Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSummary.map((row) => (
                        <tr
                          key={row.month}
                          style={row.month === monthApi ? { ...styles.tr, ...styles.trActive } : styles.tr}
                        >
                          <td style={styles.td}>{formatMonthLabel(row.month)}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>{fmt(parseFloat(row.totalAssets), defaultCurrency)}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>{fmt(parseFloat(row.totalLiabilities), defaultCurrency)}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>{fmt(parseFloat(row.netPosition), defaultCurrency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {editing ? "Edit" : "Add"} {formSection === "asset" ? "Asset" : "Liability"}
            </h3>
            <form onSubmit={handleSubmit}>
              <label style={styles.label}>
                Type
                <select
                  style={styles.input}
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as NetWorthType }))}
                >
                  {(formSection === "asset" ? ASSET_TYPES : LIABILITY_TYPES).map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Description
                <input
                  style={styles.input}
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Family home"
                  maxLength={255}
                  required
                />
              </label>

              <label style={styles.label}>
                Amount
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </label>

              <label style={styles.label}>
                Month
                <input
                  style={styles.input}
                  type="month"
                  value={form.month}
                  onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                  required
                />
              </label>

              {formError && <p style={styles.formError}>{formError}</p>}

              <div style={styles.formActions}>
                <button style={styles.cancelBtn} type="button" onClick={closeForm}>Cancel</button>
                <button style={styles.submitBtn} type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : editing ? "Save" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <DeleteConfirmDialog
          name={`${TYPE_LABELS[deleting.type]} — ${deleting.description}`}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg-page)", fontFamily: "system-ui, sans-serif" },
  main: { maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  pageTitle: { margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" },
  monthPicker: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" },
  monthInput: {
    padding: "0.4rem 0.6rem", borderRadius: "7px", border: "1px solid var(--border)",
    fontSize: "0.9rem", background: "var(--bg-card)", color: "var(--text-primary)",
  },
  status: { color: "var(--text-secondary)", textAlign: "center", padding: "2rem 0" },
  errorMsg: {
    color: "#dc2626", background: "#fef2f2", padding: "0.75rem 1rem",
    borderRadius: "8px", fontSize: "0.9rem", marginBottom: "1rem",
  },
  copyBanner: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem",
    background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px",
    padding: "0.75rem 1rem", marginBottom: "1.25rem", fontSize: "0.875rem", color: "#1e3a8a",
  },
  copyBtn: {
    background: "#2563eb", color: "#fff", border: "none", padding: "0.4rem 0.9rem",
    borderRadius: "7px", cursor: "pointer", fontSize: "0.825rem", fontWeight: 600, whiteSpace: "nowrap",
  },
  netPositionCard: {
    display: "flex", gap: "1.5rem", background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  netPositionItem: { display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 },
  netPositionLabel: { fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" },
  netPositionValue: { fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" },
  tableSection: {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.5rem",
  },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  sectionTitle: { margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" },
  addBtn: {
    background: "#2563eb", color: "#fff", border: "none",
    padding: "0.45rem 1.1rem", borderRadius: "8px", cursor: "pointer",
    fontSize: "0.875rem", fontWeight: 600,
  },
  emptyMsg: { color: "var(--text-secondary)", textAlign: "center", padding: "1.5rem 0", fontSize: "0.95rem" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" },
  th: {
    padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-secondary)", borderBottom: "1px solid var(--border)",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  trActive: { background: "rgba(37, 99, 235, 0.08)" },
  td: { padding: "0.875rem 1rem", color: "var(--text-primary)", verticalAlign: "middle" },
  totalLabel: { padding: "0.875rem 1rem", fontWeight: 700, color: "var(--text-primary)" },
  totalValue: { padding: "0.875rem 1rem", fontWeight: 700, color: "var(--text-primary)" },
  actionBtn: {
    background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)",
    padding: "0.3rem 0.75rem", borderRadius: "6px", cursor: "pointer",
    fontSize: "0.8rem", marginLeft: "0.5rem",
  },
  deleteBtn: { color: "#dc2626", borderColor: "#fca5a5" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    background: "var(--bg-card)", borderRadius: "12px", padding: "2rem",
    width: "100%", maxWidth: "420px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  },
  modalTitle: { margin: "0 0 1.25rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" },
  label: {
    display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem",
    fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)",
  },
  input: {
    padding: "0.55rem 0.75rem", borderRadius: "7px", border: "1px solid var(--border)",
    fontSize: "0.9rem", background: "var(--bg-page)", color: "var(--text-primary)",
    outline: "none", width: "100%", boxSizing: "border-box",
  },
  formError: { color: "#dc2626", fontSize: "0.85rem", margin: "0 0 0.75rem" },
  formActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" },
  cancelBtn: {
    background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)",
    padding: "0.5rem 1.25rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem",
  },
  submitBtn: {
    background: "#2563eb", color: "#fff", border: "none",
    padding: "0.5rem 1.25rem", borderRadius: "8px", cursor: "pointer",
    fontSize: "0.9rem", fontWeight: 600,
  },
};
