import { useState, useEffect, useRef } from "react";
import { NavBar } from "../components/NavBar.js";
import { useIncome } from "../hooks/useIncome.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";
import type { Income, IncomePerson, IncomeAttachment } from "../api/income.js";
import {
  listIncomeAttachments,
  uploadIncomeAttachment,
  deleteIncomeAttachment,
  fetchIncomeAttachmentBlob,
} from "../api/income.js";
import { getExchangeRates } from "../api/expenses.js";
import { getSettings, SUPPORTED_CURRENCIES } from "../api/settings.js";

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FormState {
  name: string;
  date: string;
  amount: string;
  currency: string;
  personId: string;
}

const EMPTY_FORM: FormState = { name: "", date: todayISO(), amount: "", currency: "USD", personId: "" };

type SortKey = "name-asc" | "name-desc" | "amount-asc" | "amount-desc" | "person-asc" | "date-desc" | "date-asc";

export function IncomePage({ onLogout, onNavigate }: Props) {
  const { incomes, persons, loading, error, add, edit, remove, addPerson, removePerson } = useIncome();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<Income | null>(null);
  const [deleting, setDeleting] = useState<Income | null>(null);
  const [deletingPerson, setDeletingPerson] = useState<IncomePerson | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showPersonForm, setShowPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [personFormError, setPersonFormError] = useState<string | null>(null);
  const [personSubmitting, setPersonSubmitting] = useState(false);

  const [showPersonManager, setShowPersonManager] = useState(false);

  const [attachmentsIncome, setAttachmentsIncome] = useState<Income | null>(null);
  const [attachments, setAttachments] = useState<IncomeAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = localStorage.getItem("income-sort-key");
    return (saved as SortKey) ?? "date-desc";
  });

  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number> | null>(null);

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
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: todayISO(), currency: defaultCurrency });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(income: Income) {
    setEditing(income);
    setForm({
      name: income.name,
      date: income.date,
      amount: parseFloat(income.amount).toString(),
      currency: income.currency ?? defaultCurrency,
      personId: income.personId ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: todayISO(), currency: defaultCurrency });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.date) { setFormError("Date is required."); return; }
    if (isNaN(amount) || amount < 0) { setFormError("Amount must be a non-negative number."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const personId = form.personId || undefined;
      if (editing) {
        await edit(editing.id, form.name.trim(), form.date, amount, form.currency, personId ?? null);
      } else {
        await add(form.name.trim(), form.date, amount, form.currency, personId);
      }
      closeForm();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newPersonName.trim()) { setPersonFormError("Name is required."); return; }
    setPersonSubmitting(true);
    setPersonFormError(null);
    try {
      await addPerson(newPersonName.trim());
      setNewPersonName("");
      setShowPersonForm(false);
    } catch (e) {
      setPersonFormError((e as Error).message);
    } finally {
      setPersonSubmitting(false);
    }
  }

  const personMap = Object.fromEntries(persons.map((p) => [p.id, p.name]));

  const sortedIncomes = [...incomes].sort((a, b) => {
    if (sortKey === "date-desc") return b.date.localeCompare(a.date);
    if (sortKey === "date-asc") return a.date.localeCompare(b.date);
    if (sortKey === "person-asc") {
      const pA = a.personId ? (personMap[a.personId] ?? "") : "";
      const pB = b.personId ? (personMap[b.personId] ?? "") : "";
      return pA.localeCompare(pB) || a.name.localeCompare(b.name);
    }
    if (sortKey === "name-asc") return a.name.localeCompare(b.name);
    if (sortKey === "name-desc") return b.name.localeCompare(a.name);
    const amtA = rates ? convertAmount(parseFloat(a.amount), a.currency ?? defaultCurrency, defaultCurrency, rates) : parseFloat(a.amount);
    const amtB = rates ? convertAmount(parseFloat(b.amount), b.currency ?? defaultCurrency, defaultCurrency, rates) : parseFloat(b.amount);
    return sortKey === "amount-desc" ? amtB - amtA : amtA - amtB;
  });

  async function openAttachments(income: Income) {
    setAttachmentsIncome(income);
    setAttachments([]);
    setAttachmentsError(null);
    setAttachmentsLoading(true);
    try {
      const list = await listIncomeAttachments(income.id);
      setAttachments(list);
    } catch (e) {
      setAttachmentsError((e as Error).message);
    } finally {
      setAttachmentsLoading(false);
    }
  }

  function closeAttachments() {
    setAttachmentsIncome(null);
    setAttachments([]);
    setAttachmentsError(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !attachmentsIncome) return;
    if (file.type !== "application/pdf") {
      setAttachmentsError("Only PDF files are allowed.");
      return;
    }
    setUploading(true);
    setAttachmentsError(null);
    try {
      const attachment = await uploadIncomeAttachment(attachmentsIncome.id, file);
      setAttachments((prev) => [...prev, attachment]);
    } catch (e) {
      setAttachmentsError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAttachment(attachment: IncomeAttachment) {
    try {
      await deleteIncomeAttachment(attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (e) {
      setAttachmentsError((e as Error).message);
    }
  }

  async function handleViewAttachment(attachment: IncomeAttachment) {
    try {
      const url = await fetchIncomeAttachmentBlob(attachment.id);
      window.open(url, "_blank");
    } catch (e) {
      setAttachmentsError((e as Error).message);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div style={styles.page}>
      <NavBar onLogout={onLogout} onNavigate={onNavigate} activePage="income" />

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <h2 style={styles.pageTitle}>Income</h2>
          <div style={styles.toolbarRight}>
            <button style={styles.secondaryBtn} type="button" onClick={() => setShowPersonManager(true)}>
              Manage People
            </button>
            <label style={styles.sortLabel}>
              Sort by
              <select
                style={styles.sortSelect}
                value={sortKey}
                onChange={(e) => {
                  const key = e.target.value as SortKey;
                  localStorage.setItem("income-sort-key", key);
                  setSortKey(key);
                }}
              >
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="amount-desc">Amount (Highest)</option>
                <option value="amount-asc">Amount (Lowest)</option>
                <option value="person-asc">Person</option>
              </select>
            </label>
            <button style={styles.addBtn} type="button" onClick={openAdd}>
              + Add Income
            </button>
          </div>
        </div>

        {loading && <p style={styles.status}>Loading…</p>}
        {error && <p style={styles.errorMsg}>{error}</p>}

        {!loading && !error && incomes.length === 0 && (
          <p style={styles.emptyMsg}>No income entries yet. Add one to get started.</p>
        )}

        {!loading && incomes.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Person</th>
                  <th style={styles.th}>Name</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Amount ({defaultCurrency})</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Files</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedIncomes.map((income) => {
                  const cur = income.currency ?? defaultCurrency;
                  const rawAmount = parseFloat(income.amount);
                  const convertedAmount = rates ? convertAmount(rawAmount, cur, defaultCurrency, rates) : rawAmount;
                  return (
                    <tr key={income.id} style={styles.tr}>
                      <td style={styles.td}>{income.date}</td>
                      <td style={styles.td}>
                        {income.personId ? (
                          <span style={styles.personTag}>{personMap[income.personId] ?? "—"}</span>
                        ) : (
                          <span style={styles.noPersonTag}>—</span>
                        )}
                      </td>
                      <td style={styles.td}>{income.name}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {fmt(convertedAmount, defaultCurrency)}
                        {cur !== defaultCurrency && <span style={styles.currencyTag}>{cur}</span>}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        <button
                          style={styles.attachBtn}
                          type="button"
                          title="Manage payslips"
                          onClick={() => openAttachments(income)}
                        >
                          📎
                        </button>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button style={styles.actionBtn} type="button" onClick={() => openEdit(income)}>Edit</button>
                        <button
                          style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                          type="button"
                          onClick={() => setDeleting(income)}
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
      </main>

      {/* Add/Edit Income Modal */}
      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>{editing ? "Edit Income" : "Add Income"}</h3>
            <form onSubmit={handleSubmit}>
              <label style={styles.label}>
                Person (optional)
                <select
                  style={styles.input}
                  value={form.personId}
                  onChange={(e) => setForm((f) => ({ ...f, personId: e.target.value }))}
                >
                  <option value="">— No person —</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Name
                <input
                  style={styles.input}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Salary, Freelance"
                  required
                />
              </label>

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
                <p style={styles.conversionNote}>Amounts will be shown converted to {defaultCurrency} using live rates.</p>
              )}

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

      {/* Person Manager Modal */}
      {showPersonManager && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Manage People</h3>
            {persons.length === 0 && !showPersonForm && (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                No people yet. Add one below.
              </p>
            )}
            {persons.length > 0 && (
              <ul style={styles.personList}>
                {persons.map((p) => (
                  <li key={p.id} style={styles.personItem}>
                    <span style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    <button
                      style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                      type="button"
                      onClick={() => setDeletingPerson(p)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showPersonForm ? (
              <form onSubmit={handleAddPerson} style={{ marginTop: "0.75rem" }}>
                <label style={styles.label}>
                  Name
                  <input
                    style={styles.input}
                    type="text"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="e.g. Alice"
                    autoFocus
                  />
                </label>
                {personFormError && <p style={styles.formError}>{personFormError}</p>}
                <div style={styles.formActions}>
                  <button style={styles.cancelBtn} type="button" onClick={() => { setShowPersonForm(false); setNewPersonName(""); setPersonFormError(null); }}>
                    Cancel
                  </button>
                  <button style={styles.submitBtn} type="submit" disabled={personSubmitting}>
                    {personSubmitting ? "Adding…" : "Add Person"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ ...styles.formActions, marginTop: "1rem" }}>
                <button style={styles.cancelBtn} type="button" onClick={() => setShowPersonManager(false)}>Close</button>
                <button style={styles.addBtn} type="button" onClick={() => setShowPersonForm(true)}>+ Add Person</button>
              </div>
            )}
          </div>
        </div>
      )}

      {deleting && (
        <DeleteConfirmDialog
          name={deleting.name}
          onConfirm={async () => { await remove(deleting.id); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      )}

      {deletingPerson && (
        <DeleteConfirmDialog
          name={deletingPerson.name}
          onConfirm={async () => { await removePerson(deletingPerson.id); setDeletingPerson(null); }}
          onCancel={() => setDeletingPerson(null)}
        />
      )}

      {/* Attachments Modal */}
      {attachmentsIncome && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: "520px" }}>
            <h3 style={styles.modalTitle}>Payslips — {attachmentsIncome.name}</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "-0.75rem", marginBottom: "1rem" }}>
              {attachmentsIncome.date}
            </p>

            {attachmentsLoading && <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading…</p>}

            {!attachmentsLoading && attachments.length === 0 && (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                No payslips attached yet.
              </p>
            )}

            {!attachmentsLoading && attachments.length > 0 && (
              <ul style={styles.attachList}>
                {attachments.map((a) => (
                  <li key={a.id} style={styles.attachItem}>
                    <div style={styles.attachInfo}>
                      <span style={styles.attachName}>{a.originalName}</span>
                      <span style={styles.attachMeta}>{formatFileSize(a.fileSize)}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        style={styles.actionBtn}
                        type="button"
                        onClick={() => handleViewAttachment(a)}
                      >
                        View
                      </button>
                      <button
                        style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                        type="button"
                        onClick={() => handleDeleteAttachment(a)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {attachmentsError && <p style={styles.formError}>{attachmentsError}</p>}

            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <label style={{ ...styles.label, marginBottom: 0 }}>
                <span>Attach a PDF payslip</span>
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
  main: { maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  pageTitle: { margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" },
  toolbarRight: { display: "flex", alignItems: "center", gap: "0.75rem" },
  addBtn: {
    background: "#16a34a", color: "#fff", border: "none",
    padding: "0.5rem 1.25rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600,
  },
  secondaryBtn: {
    background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)",
    padding: "0.5rem 1rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem",
  },
  sortLabel: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" },
  sortSelect: {
    padding: "0.4rem 0.6rem", borderRadius: "7px", border: "1px solid var(--border)",
    fontSize: "0.85rem", background: "var(--bg-page)", color: "var(--text-primary)", cursor: "pointer",
  },
  status: { color: "var(--text-secondary)", textAlign: "center", padding: "3rem 0" },
  errorMsg: { color: "#dc2626", background: "#fef2f2", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.9rem", marginBottom: "1rem" },
  emptyMsg: { color: "var(--text-secondary)", textAlign: "center", padding: "3rem 0", fontSize: "0.95rem" },
  tableWrap: { overflowX: "auto", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" },
  th: { padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "0.875rem 1rem", color: "var(--text-primary)", verticalAlign: "middle" },
  personTag: { display: "inline-block", fontSize: "0.8rem", fontWeight: 600, background: "#dcfce7", color: "#15803d", padding: "0.15rem 0.5rem", borderRadius: "4px" },
  noPersonTag: { color: "var(--text-secondary)", fontSize: "0.85rem" },
  currencyTag: { display: "inline-block", marginLeft: "0.4rem", fontSize: "0.7rem", fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", padding: "0.1rem 0.4rem", borderRadius: "4px" },
  actionBtn: { background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "0.3rem 0.75rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", marginLeft: "0.5rem" },
  deleteBtn: { color: "#dc2626", borderColor: "#fca5a5" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "var(--bg-card)", borderRadius: "12px", padding: "2rem", width: "100%", maxWidth: "440px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" },
  modalTitle: { margin: "0 0 1.25rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" },
  label: { display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" },
  input: { padding: "0.55rem 0.75rem", borderRadius: "7px", border: "1px solid var(--border)", fontSize: "0.9rem", background: "var(--bg-page)", color: "var(--text-primary)", outline: "none", width: "100%", boxSizing: "border-box" },
  amountRow: { display: "flex", gap: "0.75rem", alignItems: "flex-start" },
  conversionNote: { fontSize: "0.8rem", color: "#2563eb", margin: "-0.25rem 0 0.75rem" },
  formError: { color: "#dc2626", fontSize: "0.85rem", margin: "0 0 0.75rem" },
  formActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" },
  cancelBtn: { background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "0.5rem 1.25rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem" },
  submitBtn: { background: "#16a34a", color: "#fff", border: "none", padding: "0.5rem 1.25rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 },
  personList: { listStyle: "none", margin: "0 0 0.5rem", padding: 0 },
  personItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" },
  attachBtn: { background: "transparent", border: "none", fontSize: "1rem", cursor: "pointer", padding: "0.2rem 0.4rem", borderRadius: "4px", lineHeight: 1 },
  attachList: { listStyle: "none", margin: "0 0 0.75rem", padding: 0 },
  attachItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" },
  attachInfo: { display: "flex", flexDirection: "column" as const, gap: "0.15rem", minWidth: 0 },
  attachName: { fontSize: "0.9rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "260px" },
  attachMeta: { fontSize: "0.75rem", color: "var(--text-secondary)" },
};
