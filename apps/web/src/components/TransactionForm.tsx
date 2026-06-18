import { useState, type FormEvent } from "react";
import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from "../api/transactions.js";
import type { Account } from "../api/accounts.js";
import type { Category } from "../api/categories.js";

interface Props {
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onSave: (tx: Transaction) => void;
  onCancel: () => void;
  onCreate: (input: CreateTransactionInput) => Promise<Transaction>;
  onUpdate: (id: string, input: UpdateTransactionInput) => Promise<Transaction>;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({
  transaction,
  accounts,
  categories,
  onSave,
  onCancel,
  onCreate,
  onUpdate,
}: Props) {
  const isEdit = !!transaction;

  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? "");
  const [amountStr, setAmountStr] = useState(
    transaction ? String(parseFloat(transaction.amount)) : "",
  );
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      setError("Please enter a valid amount (e.g. -12.50 or 500.00)");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let saved: Transaction;
      if (isEdit) {
        saved = await onUpdate(transaction!.id, {
          description,
          categoryId: categoryId || null,
          date,
          amount,
        });
      } else {
        saved = await onCreate({
          accountId,
          amount,
          date,
          description,
          categoryId: categoryId || undefined,
        });
      }
      onSave(saved);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  if (!isEdit && accounts.length === 0) {
    return (
      <div style={styles.overlay} onClick={onCancel}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h2 style={styles.title}>Add Transaction</h2>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 1.5rem" }}>
            You need at least one account before adding transactions.
            <br />
            Go to <strong>Accounts</strong> to add one.
          </p>
          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{isEdit ? "Edit Transaction" : "Add Transaction"}</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          {!isEdit && (
            <label style={styles.label}>
              Account
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                style={styles.input}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={styles.label}>
            Amount
            <input
              type="number"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
              style={styles.input}
              placeholder="-12.50 for expense, 500.00 for income"
              autoFocus={!isEdit}
            />
            <span style={styles.hint}>Negative = expense, positive = income</span>
          </label>

          <label style={styles.label}>
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Description
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={255}
              style={styles.input}
              placeholder="Coffee, Salary, Rent…"
            />
          </label>

          <label style={styles.label}>
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={styles.input}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={onCancel}
              style={styles.cancelBtn}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
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
    zIndex: 100,
    padding: "1rem",
  },
  modal: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "1.75rem",
    width: "100%",
    maxWidth: "460px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  title: {
    margin: "0 0 1.25rem",
    fontSize: "1.2rem",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--text-label)",
  },
  input: {
    padding: "0.625rem 0.75rem",
    border: "1px solid var(--border-input)",
    borderRadius: "6px",
    fontSize: "1rem",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
  },
  hint: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
  },
  error: {
    color: "#dc2626",
    fontSize: "0.875rem",
    margin: 0,
    background: "#fef2f2",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
  },
  actions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
    marginTop: "0.5rem",
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
  submitBtn: {
    padding: "0.625rem 1.25rem",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
};
