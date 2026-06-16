import { useState, useEffect } from "react";
import { getDashboardSummary, type DashboardSummary } from "../api/budgets.js";
import { NavBar } from "../components/NavBar.js";

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

function fmt(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function DashboardPage({ onLogout, onNavigate }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.page}>
      <NavBar onLogout={onLogout} onNavigate={onNavigate} activePage="dashboard" />

      <main style={styles.main}>
        {loading && <p style={styles.status}>Loading…</p>}
        {error && <p style={styles.errorMsg}>{error}</p>}

        {!loading && !error && (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Total balance</p>
              <p style={styles.summaryValue}>
                {summary ? fmt(summary.totalBalance) : "—"}
              </p>
            </div>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Spent this month</p>
              <p style={{ ...styles.summaryValue, color: "#dc2626" }}>
                {summary ? fmt(summary.totalSpentThisMonth) : "—"}
              </p>
            </div>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Income this month</p>
              <p style={{ ...styles.summaryValue, color: "#16a34a" }}>
                {summary ? fmt(summary.totalIncomeThisMonth) : "—"}
              </p>
            </div>
          </div>
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
  main: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  summaryCard: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "1.25rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid var(--border)",
  },
  summaryLabel: {
    margin: "0 0 0.375rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  summaryValue: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--text-primary)",
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
};
