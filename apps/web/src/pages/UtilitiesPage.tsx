import { useState, useEffect, useRef } from "react";
import { useUtilities } from "../hooks/useUtilities.js";
import { NavBar } from "../components/NavBar.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";
import type { Utility, UtilityType, UtilityAttachment } from "../api/utilities.js";
import {
  listAllUtilityAttachments,
  uploadUtilityAttachment,
  deleteUtilityAttachment,
  fetchUtilityAttachmentBlob,
} from "../api/utilities.js";
import { getExchangeRates } from "../api/expenses.js";
import { getSettings, SUPPORTED_CURRENCIES } from "../api/settings.js";

const UTILITY_LABELS: Record<UtilityType, string> = {
  gas: "Gas",
  power: "Power",
  water: "Water",
};

const UTILITY_TYPES: UtilityType[] = ["gas", "power", "water"];

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

interface FormState {
  date: string;
  amount: string;
  serviceDays: string;
  currency: string;
}

export function UtilitiesPage({ onLogout, onNavigate }: Props) {
  const { utilities, loading, error, add, edit, remove } = useUtilities();

  const [activeType, setActiveType] = useState<UtilityType>("gas");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({ date: "", amount: "", serviceDays: "", currency: "USD" });
  const [editing, setEditing] = useState<Utility | null>(null);
  const [deleting, setDeleting] = useState<Utility | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  const [attachmentMap, setAttachmentMap] = useState<Record<string, UtilityAttachment>>({});
  const [attachmentsUtility, setAttachmentsUtility] = useState<Utility | null>(null);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setDefaultCurrency(s.defaultCurrency);
        setForm((f) => ({ ...f, currency: s.defaultCurrency }));
      })
      .catch(() => {});

    getExchangeRates()
      .then(({ rates }) => setRates(rates))
      .catch(() => {});

    listAllUtilityAttachments()
      .then((list) => {
        const map: Record<string, UtilityAttachment> = {};
        for (const a of list) map[a.utilityId] = a;
        setAttachmentMap(map);
      })
      .catch(() => {});
  }, []);

  const typeEntries = utilities.filter((u) => u.type === activeType);

  function openAdd() {
    setEditing(null);
    setForm({ date: "", amount: "", serviceDays: "", currency: defaultCurrency });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(u: Utility) {
    setEditing(u);
    setForm({
      date: u.date,
      amount: parseFloat(u.amount).toString(),
      serviceDays: u.serviceDays.toString(),
      currency: u.currency ?? defaultCurrency,
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ date: "", amount: "", serviceDays: "", currency: defaultCurrency });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    const serviceDays = parseInt(form.serviceDays, 10);
    if (!form.date) { setFormError("Date is required."); return; }
    if (isNaN(amount) || amount < 0) { setFormError("Amount must be a non-negative number."); return; }
    if (isNaN(serviceDays) || serviceDays < 1) { setFormError("Service days must be at least 1."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await edit(editing.id, form.date, amount, serviceDays, form.currency);
      } else {
        await add(activeType, form.date, amount, serviceDays, form.currency);
      }
      closeForm();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(u: Utility) {
    await remove(u.id);
    setDeleting(null);
  }

  function toDefault(u: Utility): number {
    const raw = parseFloat(u.amount);
    if (!rates) return raw;
    return convertAmount(raw, u.currency ?? defaultCurrency, defaultCurrency, rates);
  }

  function openAttachments(utility: Utility) {
    setAttachmentsUtility(utility);
    setAttachmentsError(null);
  }

  function closeAttachments() {
    setAttachmentsUtility(null);
    setAttachmentsError(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !attachmentsUtility) return;
    if (file.type !== "application/pdf") {
      setAttachmentsError("Only PDF files are allowed.");
      return;
    }
    setUploading(true);
    setAttachmentsError(null);
    try {
      const attachment = await uploadUtilityAttachment(attachmentsUtility.id, file);
      setAttachmentMap((prev) => ({ ...prev, [attachmentsUtility.id]: attachment }));
    } catch (e) {
      setAttachmentsError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAttachment(attachment: UtilityAttachment) {
    try {
      await deleteUtilityAttachment(attachment.id);
      setAttachmentMap((prev) => {
        const next = { ...prev };
        delete next[attachment.utilityId];
        return next;
      });
    } catch (e) {
      setAttachmentsError((e as Error).message);
    }
  }

  async function handleViewAttachment(attachment: UtilityAttachment) {
    try {
      const url = await fetchUtilityAttachmentBlob(attachment.id);
      window.open(url, "_blank");
    } catch (e) {
      setAttachmentsError((e as Error).message);
    }
  }

  async function handleViewAttachmentForUtility(utilityId: string) {
    const attachment = attachmentMap[utilityId];
    if (!attachment) return;
    try {
      const url = await fetchUtilityAttachmentBlob(attachment.id);
      window.open(url, "_blank");
    } catch {
      // silently ignore — user can open the modal for details
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div style={styles.page}>
      <NavBar onLogout={onLogout} onNavigate={onNavigate} activePage="utilities" />

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <h2 style={styles.pageTitle}>Utilities</h2>
        </div>

        <div style={styles.tabs}>
          {UTILITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              style={activeType === t ? { ...styles.tab, ...styles.tabActive } : styles.tab}
              onClick={() => setActiveType(t)}
            >
              {UTILITY_LABELS[t]}
            </button>
          ))}
        </div>

        <div style={styles.tableSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>{UTILITY_LABELS[activeType]} Bills</h3>
            <button style={styles.addBtn} type="button" onClick={openAdd}>+ Add Bill</button>
          </div>

          {loading && <p style={styles.status}>Loading…</p>}
          {error && <p style={styles.errorMsg}>{error}</p>}

          {!loading && !error && typeEntries.length === 0 && (
            <p style={styles.emptyMsg}>
              No {UTILITY_LABELS[activeType].toLowerCase()} bills yet. Add one to get started.
            </p>
          )}

          {!loading && typeEntries.length > 0 && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Service Days</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Per Day</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Files</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...typeEntries]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((u) => {
                      const converted = toDefault(u);
                      const perDay = converted / u.serviceDays;
                      return (
                        <tr key={u.id} style={styles.tr}>
                          <td style={styles.td}>{u.date}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            {fmt(converted, defaultCurrency)}
                            {(u.currency ?? defaultCurrency) !== defaultCurrency && (
                              <span style={styles.currencyTag}>{u.currency}</span>
                            )}
                          </td>
                          <td style={{ ...styles.td, textAlign: "right" }}>{u.serviceDays}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>{fmt(perDay, defaultCurrency)}</td>
                          <td style={{ ...styles.td, textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                              <button
                                style={styles.attachBtn}
                                type="button"
                                title={attachmentMap[u.id] ? "Replace or remove bill" : "Attach bill PDF"}
                                onClick={() => openAttachments(u)}
                              >
                                📎
                              </button>
                              {attachmentMap[u.id] && (
                                <button
                                  style={styles.attachBtn}
                                  type="button"
                                  title={`View ${attachmentMap[u.id]!.originalName}`}
                                  onClick={() => handleViewAttachmentForUtility(u.id)}
                                >
                                  👁
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            <button style={styles.actionBtn} type="button" onClick={() => openEdit(u)}>Edit</button>
                            <button
                              style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                              type="button"
                              onClick={() => setDeleting(u)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {editing ? "Edit" : "Add"} {UTILITY_LABELS[activeType]} Bill
            </h3>
            <form onSubmit={handleSubmit}>
              <label style={styles.label}>
                Date
                <input
                  style={styles.input}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </label>

              <div style={styles.amountRow}>
                <label style={{ ...styles.label, flex: 1 }}>
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
                <label style={{ ...styles.label, width: "110px" }}>
                  Currency
                  <select
                    style={styles.input}
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </label>
              </div>

              {form.currency !== defaultCurrency && rates && (
                <p style={styles.conversionNote}>
                  Amounts will be shown converted to {defaultCurrency} using live rates.
                </p>
              )}

              <label style={styles.label}>
                Service Days
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  step="1"
                  value={form.serviceDays}
                  onChange={(e) => setForm((f) => ({ ...f, serviceDays: e.target.value }))}
                  placeholder="e.g. 30"
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
          name={`${UTILITY_LABELS[deleting.type]} bill on ${deleting.date}`}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* Attachments Modal */}
      {attachmentsUtility && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: "480px" }}>
            <h3 style={styles.modalTitle}>
              Bill — {UTILITY_LABELS[attachmentsUtility.type]}
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "-0.75rem", marginBottom: "1.25rem" }}>
              {attachmentsUtility.date}
            </p>

            {(() => {
              const a = attachmentMap[attachmentsUtility.id];
              if (a) {
                return (
                  <div style={styles.attachItem}>
                    <div style={styles.attachInfo}>
                      <span style={styles.attachName}>{a.originalName}</span>
                      <span style={styles.attachMeta}>{formatFileSize(a.fileSize)}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button style={styles.actionBtn} type="button" onClick={() => handleViewAttachment(a)}>View</button>
                      <button
                        style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                        type="button"
                        onClick={() => handleDeleteAttachment(a)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                    No bill attached yet.
                  </p>
                  <label style={{ ...styles.label, marginBottom: 0 }}>
                    <span>Attach a PDF bill</span>
                    <input
                      ref={fileInputRef}
                      style={{ ...styles.input, cursor: "pointer" }}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                  {uploading && <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>Uploading…</p>}
                </div>
              );
            })()}

            {attachmentsError && <p style={{ ...styles.formError, marginTop: "0.75rem" }}>{attachmentsError}</p>}

            <div style={{ ...styles.formActions, marginTop: "1.25rem" }}>
              <button style={styles.cancelBtn} type="button" onClick={closeAttachments}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg-page)", fontFamily: "system-ui, sans-serif" },
  main: { maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  pageTitle: { margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" },
  tabs: {
    display: "flex", gap: "0.5rem", marginBottom: "1.5rem",
    borderBottom: "2px solid var(--border)", paddingBottom: "0",
  },
  tab: {
    background: "transparent", border: "none", borderBottom: "2px solid transparent",
    marginBottom: "-2px", color: "var(--text-secondary)", padding: "0.5rem 1.25rem",
    cursor: "pointer", fontSize: "0.95rem", fontWeight: 500, borderRadius: "4px 4px 0 0",
  },
  tabActive: { borderBottomColor: "#2563eb", color: "#2563eb", fontWeight: 700 },
  tableSection: {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  sectionTitle: { margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" },
  addBtn: {
    background: "#2563eb", color: "#fff", border: "none",
    padding: "0.45rem 1.1rem", borderRadius: "8px", cursor: "pointer",
    fontSize: "0.875rem", fontWeight: 600,
  },
  status: { color: "var(--text-secondary)", textAlign: "center", padding: "2rem 0" },
  errorMsg: {
    color: "#dc2626", background: "#fef2f2", padding: "0.75rem 1rem",
    borderRadius: "8px", fontSize: "0.9rem", marginBottom: "1rem",
  },
  emptyMsg: { color: "var(--text-secondary)", textAlign: "center", padding: "2rem 0", fontSize: "0.95rem" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" },
  th: {
    padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-secondary)", borderBottom: "1px solid var(--border)",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "0.875rem 1rem", color: "var(--text-primary)", verticalAlign: "middle" },
  currencyTag: {
    display: "inline-block", marginLeft: "0.4rem", fontSize: "0.7rem", fontWeight: 700,
    background: "#dbeafe", color: "#1d4ed8", padding: "0.1rem 0.4rem", borderRadius: "4px",
  },
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
  amountRow: { display: "flex", gap: "0.75rem", alignItems: "flex-start" },
  conversionNote: { fontSize: "0.8rem", color: "#2563eb", margin: "-0.25rem 0 0.75rem" },
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
  attachBtn: { background: "transparent", border: "none", fontSize: "1rem", cursor: "pointer", padding: "0.2rem 0.4rem", borderRadius: "4px", lineHeight: 1 },
  attachItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" },
  attachInfo: { display: "flex", flexDirection: "column" as const, gap: "0.15rem", minWidth: 0 },
  attachName: { fontSize: "0.9rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "260px" },
  attachMeta: { fontSize: "0.75rem", color: "var(--text-secondary)" },
};
