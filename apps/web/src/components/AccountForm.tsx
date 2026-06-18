import { useState, type FormEvent } from "react";
import type { Account, AccountType } from "../api/accounts.js";
import { SUPPORTED_CURRENCIES } from "../api/settings.js";

interface Props {
  initial?: Account;
  onSubmit: (name: string, type: AccountType, initialBalance: number, currency: string) => Promise<void>;
  onCancel: () => void;
  title: string;
  defaultCurrency?: string;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit" },
  { value: "cash", label: "Cash" },
];

export function AccountForm({ initial, onSubmit, onCancel, title, defaultCurrency = "USD" }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AccountType>(initial?.type ?? "checking");
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [balance, setBalance] = useState(initial ? parseFloat(initial.currentBalance) : 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(name.trim(), type, balance, currency);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>{title}</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Account name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              style={styles.input}
              autoFocus
            />
          </label>
          <label style={styles.label}>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as AccountType)} style={styles.input}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={styles.input}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {!initial && (
            <label style={styles.label}>
              Opening balance
              <input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                style={styles.input}
              />
            </label>
          )}
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={loading}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? "Saving…" : "Save"}
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
