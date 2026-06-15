import { useState } from "react";
import { useExpenses } from "../hooks/useExpenses.js";
import { useTheme } from "../hooks/useTheme.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";
import type { Expense, ExpenseFrequency } from "../api/expenses.js";

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

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

interface FormState {
  name: string;
  amount: string;
  frequency: ExpenseFrequency;
}

const EMPTY_FORM: FormState = { name: "", amount: "", frequency: "monthly" };

export function ExpensesPage({ onLogout, onNavigate }: Props) {
  const { expenses, loading, error, add, edit, remove } = useExpenses();
  const { isDark, toggleTheme } = useTheme();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      name: expense.name,
      amount: parseFloat(expense.amount).toString(),
      frequency: expense.frequency,
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
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
        await edit(editing.id, form.name.trim(), amount, form.frequency);
      } else {
        await add(form.name.trim(), amount, form.frequency);
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
          <button style={styles.addBtn} type="button" onClick={openAdd}>
            + Add Expense
          </button>
        </div>

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
                  <th style={{ ...styles.th, textAlign: "right" }}>Fortnightly</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Monthly</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Yearly</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const amounts = calcAmounts(expense.amount, expense.frequency);
                  return (
                    <tr key={expense.id} style={styles.tr}>
                      <td style={styles.td}>{expense.name}</td>
                      <td style={styles.td}>
                        {fmt(parseFloat(expense.amount))} / {FREQUENCY_LABELS[expense.frequency]}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {fmt(amounts.fortnightly)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {fmt(amounts.monthly)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {fmt(amounts.yearly)}
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

              <label style={styles.label}>
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
    maxWidth: "420px",
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
};
