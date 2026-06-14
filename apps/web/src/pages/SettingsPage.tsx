import { useState, useEffect, type FormEvent } from "react";
import { getSettings, updateSettings, SUPPORTED_CURRENCIES } from "../api/settings.js";

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

export function SettingsPage({ onLogout, onNavigate }: Props) {
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setDefaultCurrency(s.defaultCurrency);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateSettings({ defaultCurrency });
      setDefaultCurrency(result.defaultCurrency);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>BudgetApp</h1>
        <nav style={{ display: "flex", gap: "0.25rem", flex: 1 }}>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("dashboard")}>
            Dashboard
          </button>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("transactions")}>
            Transactions
          </button>
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("accounts")}>
            Accounts
          </button>
          <button
            style={{ ...styles.navBtn, background: "rgba(255,255,255,0.12)", color: "#fff" }}
            type="button"
          >
            Settings
          </button>
        </nav>
        <button onClick={onLogout} style={styles.logoutBtn} type="button">
          Sign out
        </button>
      </header>

      <main style={styles.main}>
        <h2 style={styles.pageTitle}>Settings</h2>

        {loading && <p style={styles.status}>Loading…</p>}

        {!loading && (
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Currency</h3>
            <p style={styles.sectionDesc}>
              Set your default currency. New accounts will use this currency by default.
            </p>
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>
                Default currency
                <select
                  value={defaultCurrency}
                  onChange={(e) => { setDefaultCurrency(e.target.value); setSaved(false); }}
                  style={styles.select}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p style={styles.error}>{error}</p>}
              {saved && <p style={styles.success}>Settings saved.</p>}
              <div style={styles.actions}>
                <button type="submit" style={styles.saveBtn} disabled={saving}>
                  {saving ? "Saving…" : "Save settings"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fa",
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
    fontSize: "1.25rem",
    fontWeight: 700,
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
    maxWidth: "640px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  pageTitle: {
    margin: "0 0 1.5rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#1a1a2e",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "1.75rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb",
  },
  sectionTitle: {
    margin: "0 0 0.375rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#1a1a2e",
  },
  sectionDesc: {
    margin: "0 0 1.25rem",
    fontSize: "0.875rem",
    color: "#6b7280",
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
    color: "#374151",
  },
  select: {
    padding: "0.625rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "1rem",
    background: "#fff",
  },
  error: {
    color: "#dc2626",
    fontSize: "0.875rem",
    margin: 0,
    background: "#fef2f2",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
  },
  success: {
    color: "#16a34a",
    fontSize: "0.875rem",
    margin: 0,
    background: "#f0fdf4",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  saveBtn: {
    padding: "0.625rem 1.5rem",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  status: {
    color: "#666",
    textAlign: "center",
    padding: "3rem 0",
  },
};
