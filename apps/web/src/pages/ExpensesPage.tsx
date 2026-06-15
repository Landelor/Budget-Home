import { useState, useEffect } from "react";
import { useExpenses } from "../hooks/useExpenses.js";
import { useTheme } from "../hooks/useTheme.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";
import type { Expense, ExpenseFrequency } from "../api/expenses.js";
import { getExchangeRates } from "../api/expenses.js";
import { getSettings, SUPPORTED_CURRENCIES } from "../api/settings.js";
import { listUtilities } from "../api/utilities.js";
import type { Utility, UtilityType } from "../api/utilities.js";

const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function calcAmounts(amount: string, frequency: ExpenseFrequency) {
  const n = parseFloat(amount);
  let yearly: number;
  if (frequency === "yearly") {
    yearly = n;
  } else if (frequency === "monthly") {
    yearly = n * 12;
  } else {
    yearly = n * 26;
  }
  return {
    fortnightly: yearly / 26,
    monthly: yearly / 12,
    yearly,
  };
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmt2(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

interface FormState {
  name: string;
  amount: string;
  frequency: ExpenseFrequency;
  currency: string;
}

const EMPTY_FORM: FormState = { name: "", amount: "", frequency: "monthly", currency: "USD" };

type SortKey = "name-asc" | "name-desc" | "amount-asc" | "amount-desc";

export function ExpensesPage({ onLogout, onNavigate }: Props) {
  const { expenses, loading, error, add, edit, remove } = useExpenses();
  const { isDark, toggleTheme } = useTheme();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = localStorage.getItem("expenses-sort-key");
    return (saved as SortKey) ?? "name-asc";
  });

  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesDate, setRatesDate] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [utilityEntries, setUtilityEntries] = useState<Utility[]>([]);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setDefaultCurrency(s.defaultCurrency);
        setForm((f) => ({ ...f, currency: s.defaultCurrency }));
      })
      .catch(() => {});

    getExchangeRates()
      .then(({ rates, date }) => {
        setRates(rates);
        setRatesDate(date);
      })
      .catch(() => {
        setRatesError("Could not load exchange rates");
      });

    listUtilities()
      .then(setUtilityEntries)
      .catch(() => {});
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, currency: defaultCurrency });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      name: expense.name,
      amount: parseFloat(expense.amount).toString(),
      frequency: expense.frequency,
      currency: expense.currency ?? defaultCurrency,
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM, currency: defaultCurrency });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (isNaN(amount) || amount < 0) {
      setFormError("Amount must be a non-negative number.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await edit(editing.id, form.name.trim(), amount, form.frequency, form.currency);
      } else {
        await add(form.name.trim(), amount, form.frequency, form.currency);
      }
      closeForm();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(expense: Expense) {
    await remove(expense.id);
    setDeleting(null);
  }

  // Utility averages per type, amounts converted to default currency
  function utilityStats(type: UtilityType) {
    const rows = utilityEntries.filter((u) => u.type === type);
    if (rows.length === 0) return null;
    const avgAmount = rows.reduce((s, u) => {
      const raw = parseFloat(u.amount);
      const cur = u.currency ?? defaultCurrency;
      return s + (rates ? convertAmount(raw, cur, defaultCurrency, rates) : raw);
    }, 0) / rows.length;
    const avgDays = rows.reduce((s, u) => s + u.serviceDays, 0) / rows.length;
    const perDay = avgAmount / avgDays;
    const perFortnight = perDay * 14;
    return { avgAmount, avgDays, perDay, perFortnight, count: rows.length };
  }

  const utilityTypes: UtilityType[] = ["gas", "power", "water"];
  const utilityTypeLabels: Record<UtilityType, string> = { gas: "Gas", power: "Power", water: "Water" };
  const hasUtilities = utilityEntries.length > 0;

  // Currencies actually used in expenses (excluding default)
  const foreignCurrencies = [...new Set(
    expenses
      .map((e) => e.currency ?? defaultCurrency)
      .filter((c) => c !== defaultCurrency),
  )];

  const showRatesCard = foreignCurrencies.length > 0;

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (sortKey === "name-asc") return a.name.localeCompare(b.name);
    if (sortKey === "name-desc") return b.name.localeCompare(a.name);
    const yearlyA = (() => {
      const cur = a.currency ?? defaultCurrency;
      const y = calcAmounts(a.amount, a.frequency).yearly;
      return rates ? convertAmount(y, cur, defaultCurrency, rates) : y;
    })();
    const yearlyB = (() => {
      const cur = b.currency ?? defaultCurrency;
      const y = calcAmounts(b.amount, b.frequency).yearly;
      return rates ? convertAmount(y, cur, defaultCurrency, rates) : y;
    })();
    return sortKey === "amount-desc" ? yearlyB - yearlyA : yearlyA - yearlyB;
  });

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>BudgetApp</h1>
        <nav style={styles.nav}>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("dashboard")}>
            Dashboard
          </button>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("transactions")}>
            Transactions
          </button>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("accounts")}>
            Accounts
          </button>
          <button style={{ ...styles.navBtn, ...styles.navBtnActive }} type="button">
            Expenses
          </button>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("utilities")}>
            Utilities
          </button>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("settings")}>
            Settings
          </button>
        </nav>
        <button onClick={toggleTheme} style={styles.themeBtn} type="button" title="Toggle dark mode">
          {isDark ? "Light mode" : "Dark mode"}
        </button>
        <button onClick={onLogout} style={styles.logoutBtn} type="button">
          Sign out
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <h2 style={styles.pageTitle}>Expenses</h2>
          <div style={styles.toolbarRight}>
            <label style={styles.sortLabel}>
              Sort by
              <select
                style={styles.sortSelect}
                value={sortKey}
                onChange={(e) => {
                  const key = e.target.value as SortKey;
                  localStorage.setItem("expenses-sort-key", key);
                  setSortKey(key);
                }}
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="amount-desc">Amount (Highest)</option>
                <option value="amount-asc">Amount (Lowest)</option>
              </select>
            </label>
            <button style={styles.addBtn} type="button" onClick={openAdd}>
              + Add Expense
            </button>
          </div>
        </div>

        {showRatesCard && rates && (
          <div style={styles.ratesCard}>
            <div style={styles.ratesCardHeader}>
              <span style={styles.ratesCardTitle}>Exchange Rates</span>
              {ratesDate && (
                <span style={styles.ratesCardDate}>
                  Rates as of {ratesDate} (base: {defaultCurrency})
                </span>
              )}
            </div>
            <div style={styles.ratesGrid}>
              {foreignCurrencies.map((c) => {
                const fromRate = rates[c];
                const toRate = rates[defaultCurrency];
                if (!fromRate || !toRate) return null;
                const rate = toRate / fromRate;
                return (
                  <div key={c} style={styles.rateItem}>
                    <span style={styles.rateCurrency}>{c}</span>
                    <span style={styles.rateArrow}>→</span>
                    <span style={styles.rateValue}>
                      {rate.toFixed(4)} {defaultCurrency}
                    </span>
                  </div>
                );
              })}
            </div>
            {ratesError && <p style={styles.ratesError}>{ratesError}</p>}
          </div>
        )}

        {hasUtilities && (
          <div style={styles.utilitiesCard}>
            <div style={styles.utilitiesCardHeader}>
              <span style={styles.utilitiesCardTitle}>Utilities</span>
            </div>
            <div style={styles.utilitiesGrid}>
              {utilityTypes.map((type) => {
                const stats = utilityStats(type);
                if (!stats) return null;
                return (
                  <div key={type} style={styles.utilityItem}>
                    <div style={styles.utilityLabel}>{utilityTypeLabels[type]}</div>
                    <div style={styles.utilityStats}>
                      <div style={styles.utilityStat}>
                        <span style={styles.utilityStatLabel}>Avg Bill</span>
                        <span style={styles.utilityStatValue}>${fmt2(stats.avgAmount)}</span>
                      </div>
                      <div style={styles.utilityStat}>
                        <span style={styles.utilityStatLabel}>Avg Days</span>
                        <span style={styles.utilityStatValue}>{stats.avgDays.toFixed(1)}</span>
                      </div>
                      <div style={styles.utilityStat}>
                        <span style={styles.utilityStatLabel}>Per Day</span>
                        <span style={styles.utilityStatValue}>${fmt2(stats.perDay)}</span>
                      </div>
                      <div style={styles.utilityStat}>
                        <span style={styles.utilityStatLabel}>Per Fortnight</span>
                        <span style={styles.utilityStatValue}>${fmt2(stats.perFortnight)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && <p style={styles.status}>Loading…</p>}
        {error && <p style={styles.errorMsg}>{error}</p>}

        {!loading && !error && expenses.length === 0 && (
          <p style={styles.emptyMsg}>No expenses yet. Add one to get started.</p>
        )}

        {!loading && expenses.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Entered As</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Fortnightly ({defaultCurrency})</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Monthly ({defaultCurrency})</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Yearly ({defaultCurrency})</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((expense) => {
                  const expCurrency = expense.currency ?? defaultCurrency;
                  const amounts = calcAmounts(expense.amount, expense.frequency);
                  const convert = (n: number) =>
                    rates ? convertAmount(n, expCurrency, defaultCurrency, rates) : n;
                  return (
                    <tr key={expense.id} style={styles.tr}>
                      <td style={styles.td}>{expense.name}</td>
                      <td style={styles.td}>
                        {fmt(parseFloat(expense.amount), expCurrency)} / {FREQUENCY_LABELS[expense.frequency]}
                        {expCurrency !== defaultCurrency && (
                          <span style={styles.currencyTag}>{expCurrency}</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {fmt(convert(amounts.fortnightly), defaultCurrency)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {fmt(convert(amounts.monthly), defaultCurrency)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {fmt(convert(amounts.yearly), defaultCurrency)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button
                          style={styles.actionBtn}
                          type="button"
                          onClick={() => openEdit(expense)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                          type="button"
                          onClick={() => setDeleting(expense)}
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

      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>{editing ? "Edit Expense" : "Add Expense"}</h3>
            <form onSubmit={handleSubmit}>
              <label style={styles.label}>
                Name
                <input
                  style={styles.input}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Netflix, Rent"
                  required
                />
              </label>

              <label style={styles.label}>
                Frequency
                <select
                  style={styles.input}
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, frequency: e.target.value as ExpenseFrequency }))
                  }
                >
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>

              <div style={styles.amountRow}>
                <label style={{ ...styles.label, flex: 1 }}>
                  Amount ({FREQUENCY_LABELS[form.frequency]})
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
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {form.currency !== defaultCurrency && rates && (
                <p style={styles.conversionNote}>
                  Amounts will be shown converted to {defaultCurrency} using live rates.
                </p>
              )}

              {formError && <p style={styles.formError}>{formError}</p>}

              <div style={styles.formActions}>
                <button style={styles.cancelBtn} type="button" onClick={closeForm}>
                  Cancel
                </button>
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
          name={deleting.name}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--bg-page)",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    background: "#1a1a2e",
    color: "#fff",
    padding: "0.75rem 2rem",
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
  },
  heading: {
    margin: 0,
    fontSize: "1.2rem",
    fontWeight: 700,
  },
  nav: {
    display: "flex",
    gap: "0.25rem",
    flex: 1,
  },
  navBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.65)",
    padding: "0.4rem 0.875rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  navBtnActive: {
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
  },
  themeBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "rgba(255,255,255,0.8)",
    padding: "0.4rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    padding: "0.4rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  main: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  pageTitle: {
    margin: 0,
    fontSize: "1.4rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  addBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  ratesCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "1rem 1.25rem",
    marginBottom: "1.5rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  ratesCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  ratesCardTitle: {
    fontSize: "0.85rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
  },
  ratesCardDate: {
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
  },
  ratesGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.75rem",
  },
  rateItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "0.4rem 0.875rem",
    fontSize: "0.875rem",
  },
  rateCurrency: {
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  rateArrow: {
    color: "var(--text-secondary)",
  },
  rateValue: {
    color: "var(--text-primary)",
  },
  ratesError: {
    color: "#dc2626",
    fontSize: "0.8rem",
    margin: "0.5rem 0 0",
  },
  status: {
    color: "var(--text-secondary)",
    textAlign: "center",
    padding: "3rem 0",
  },
  errorMsg: {
    color: "#dc2626",
    background: "#fef2f2",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    fontSize: "0.9rem",
    marginBottom: "1rem",
  },
  emptyMsg: {
    color: "var(--text-secondary)",
    textAlign: "center",
    padding: "3rem 0",
    fontSize: "0.95rem",
  },
  tableWrap: {
    overflowX: "auto",
    background: "var(--bg-card)",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.9rem",
  },
  th: {
    padding: "0.75rem 1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border)",
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding: "0.875rem 1rem",
    color: "var(--text-primary)",
    verticalAlign: "middle",
  },
  currencyTag: {
    display: "inline-block",
    marginLeft: "0.4rem",
    fontSize: "0.7rem",
    fontWeight: 700,
    background: "#dbeafe",
    color: "#1d4ed8",
    padding: "0.1rem 0.4rem",
    borderRadius: "4px",
  },
  actionBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    padding: "0.3rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
    marginLeft: "0.5rem",
  },
  deleteBtn: {
    color: "#dc2626",
    borderColor: "#fca5a5",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "2rem",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  },
  modalTitle: {
    margin: "0 0 1.25rem",
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    marginBottom: "1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  input: {
    padding: "0.55rem 0.75rem",
    borderRadius: "7px",
    border: "1px solid var(--border)",
    fontSize: "0.9rem",
    background: "var(--bg-page)",
    color: "var(--text-primary)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  amountRow: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "flex-start",
  },
  conversionNote: {
    fontSize: "0.8rem",
    color: "#2563eb",
    margin: "-0.25rem 0 0.75rem",
  },
  formError: {
    color: "#dc2626",
    fontSize: "0.85rem",
    margin: "0 0 0.75rem",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "1.25rem",
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  submitBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  sortLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  sortSelect: {
    padding: "0.4rem 0.6rem",
    borderRadius: "7px",
    border: "1px solid var(--border)",
    fontSize: "0.85rem",
    background: "var(--bg-page)",
    color: "var(--text-primary)",
    cursor: "pointer",
  },
  utilitiesCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "1rem 1.25rem",
    marginBottom: "1.5rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  utilitiesCardHeader: {
    marginBottom: "0.875rem",
  },
  utilitiesCardTitle: {
    fontSize: "0.85rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
  },
  utilitiesGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "1rem",
  },
  utilityItem: {
    flex: "1 1 200px",
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "0.875rem 1rem",
  },
  utilityLabel: {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "0.625rem",
  },
  utilityStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.5rem",
  },
  utilityStat: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.15rem",
  },
  utilityStatLabel: {
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--text-secondary)",
  },
  utilityStatValue: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
};
