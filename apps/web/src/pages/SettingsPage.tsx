import { useState, useEffect, type FormEvent } from "react";
import { getSettings, updateSettings, SUPPORTED_CURRENCIES } from "../api/settings.js";
import { useTheme } from "../hooks/useTheme.js";

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

export function SettingsPage({ onLogout, onNavigate }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState<"MDY" | "DMY">("MDY");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setDefaultCurrency(s.defaultCurrency);
        setDateFormat(s.dateFormat ?? "MDY");
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
      const result = await updateSettings({ defaultCurrency, dateFormat });
      setDefaultCurrency(result.defaultCurrency);
      setDateFormat(result.dateFormat ?? "MDY");
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
          <button style={styles.navBtn} type="button" onClick={() => onNavigate("expenses")}>
            Expenses
          </button>
          <button
            style={{ ...styles.navBtn, background: "rgba(255,255,255,0.12)", color: "#fff" }}
            type="button"
          >
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
        <h2 style={styles.pageTitle}>Settings</h2>

        {loading && <p style={styles.status}>Loading…</p>}

        {!loading && (
          <>
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Appearance</h3>
              <p style={styles.sectionDesc}>
                Choose between light and dark color schemes.
              </p>
              <div style={styles.themeRow}>
                <span style={styles.themeLabel}>Dark mode</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  style={{
                    ...styles.toggleBtn,
                    background: isDark ? "#4f46e5" : "var(--bg-subtle)",
                  }}
                  aria-pressed={isDark}
                >
                  <span
                    style={{
                      ...styles.toggleKnob,
                      transform: isDark ? "translateX(20px)" : "translateX(0)",
                    }}
                  />
                </button>
                <span style={styles.themeStatus}>{isDark ? "On" : "Off"}</span>
              </div>
            </div>

            <div style={{ ...styles.card, marginTop: "1rem" }}>
              <h3 style={styles.sectionTitle}>Currency &amp; Date Format</h3>
              <p style={styles.sectionDesc}>
                Set your default currency and the date format used when importing CSV files.
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
                <label style={styles.label}>
                  CSV date format
                  <select
                    value={dateFormat}
                    onChange={(e) => { setDateFormat(e.target.value as "MDY" | "DMY"); setSaved(false); }}
                    style={styles.select}
                  >
                    <option value="MDY">MM/DD/YYYY (US)</option>
                    <option value="DMY">DD/MM/YYYY (international)</option>
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
          </>
        )}
      </main>
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
    maxWidth: "640px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  pageTitle: {
    margin: "0 0 1.5rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  card: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "1.75rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid var(--border)",
  },
  sectionTitle: {
    margin: "0 0 0.375rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  sectionDesc: {
    margin: "0 0 1.25rem",
    fontSize: "0.875rem",
    color: "var(--text-secondary)",
  },
  themeRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  themeLabel: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--text-label)",
  },
  toggleBtn: {
    position: "relative",
    width: "44px",
    height: "24px",
    border: "none",
    borderRadius: "999px",
    cursor: "pointer",
    padding: 0,
    transition: "background 0.2s",
  },
  toggleKnob: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.2s",
  },
  themeStatus: {
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
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
  select: {
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
    color: "var(--text-secondary)",
    textAlign: "center",
    padding: "3rem 0",
  },
};
