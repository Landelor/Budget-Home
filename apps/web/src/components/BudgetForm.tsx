import { useState, type FormEvent } from "react";
import type { Category } from "../api/categories.js";
import type { Budget, BudgetPeriod } from "../api/budgets.js";

interface Props {
  budget?: Budget | null;
  categories: Category[];
  onSubmit: (categoryId: string, period: BudgetPeriod, limitAmount: number) => Promise<void>;
  onCancel: () => void;
}

export function BudgetForm({ budget, categories, onSubmit, onCancel }: Props) {
  const isEdit = !!budget;
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? categories[0]?.id ?? "");
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? "monthly");
  const [limitStr, setLimitStr] = useState(
    budget ? String(parseFloat(budget.limitAmount)) : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const limit = parseFloat(limitStr);
    if (isNaN(limit) || limit <= 0) {
      setError("Enter a positive limit amount");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(categoryId, period, limit);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{isEdit ? "Edit Budget" : "Create Budget"}</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          {!isEdit && (
            <label style={styles.label}>
              Category
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                style={styles.input}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isEdit && (
            <label style={styles.label}>
              Period
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
                style={styles.input}
              >
                <option value="monthly">Monthly (resets 1st of each month)</option>
                <option value="weekly">Weekly (resets each Monday)</option>
              </select>
            </label>
          )}

          <label style={styles.label}>
            Limit amount
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={limitStr}
              onChange={(e) => setLimitStr(e.target.value)}
              required
              autoFocus={isEdit}
              style={styles.input}
              placeholder="e.g. 500.00"
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={loading}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save changes" : "Create budget"}
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
    maxWidth: "420px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
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
