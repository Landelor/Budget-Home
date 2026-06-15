import { useState, useEffect } from "react";
import { useAccounts } from "../hooks/useAccounts.js";
import { useTheme } from "../hooks/useTheme.js";
import { AccountForm } from "../components/AccountForm.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";
import type { Account, AccountType } from "../api/accounts.js";
import { getSettings } from "../api/settings.js";

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit",
  cash: "Cash",
};

const TYPE_COLORS: Record<AccountType, string> = {
  checking: "#dbeafe",
  savings: "#dcfce7",
  credit: "#fce7f3",
  cash: "#fef9c3",
};

interface Props {
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

export function AccountsPage({ onLogout, onNavigate }: Props) {
  const { accounts, loading, error, add, edit, remove } = useAccounts();
  const { isDark, toggleTheme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  useEffect(() => {
    getSettings()
      .then((s) => setDefaultCurrency(s.defaultCurrency))
      .catch(() => {});
  }, []);

  async function handleAdd(name: string, type: AccountType, initialBalance: number, currency: string) {
    await add(name, type, initialBalance, currency);
    setShowAdd(false);
  }

  async function handleEdit(name: string, type: AccountType, _balance: number, _currency: string) {
    if (!editing) return;
    await edit(editing.id, name, type);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    await remove(deleting.id);
    setDeleting(null);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>BudgetApp</h1>
        {onNavigate && (
          <nav style={{ display: "flex", gap: "0.25rem", flex: 1 }}>
            <button
              style={styles.navBtn}
              type="button"
              onClick={() => onNavigate("dashboard")}
            >
              Dashboard
            </button>
            <button
              style={styles.navBtn}
              type="button"
              onClick={() => onNavigate("transactions")}
            >
              Transactions
            </button>
            <button
              style={{ ...styles.navBtn, background: "rgba(255,255,255,0.12)", color: "#fff" }}
              type="button"
            >
              Accounts
            </button>
            <button
              style={styles.navBtn}
              type="button"
              onClick={() => onNavigate("expenses")}
            >
              Expenses
            </button>
            <button
              style={styles.navBtn}
              type="button"
              onClick={() => onNavigate("settings")}
            >
              Settings
            </button>
          </nav>
        )}
        <button onClick={toggleTheme} style={styles.themeBtn} type="button" title="Toggle dark mode">
          {isDark ? "Light mode" : "Dark mode"}
        </button>
        <button onClick={onLogout} style={styles.logoutBtn} type="button">
          Sign out
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>Accounts</h2>
          <button onClick={() => setShowAdd(true)} style={styles.addBtn} type="button">
            + Add account
          </button>
        </div>

        {loading && <p style={styles.status}>Loading accounts…</p>}
        {error && <p style={styles.errorMsg}>{error}</p>}

        {!loading && !error && accounts.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No accounts yet</p>
            <p style={styles.emptySub}>Add your first account to start tracking your finances.</p>
            <button onClick={() => setShowAdd(true)} style={styles.addBtn} type="button">
              + Add account
            </button>
          </div>
        )}

        {accounts.length > 0 && (
          <div style={styles.grid}>
            {accounts.map((account) => (
              <div key={account.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <span
                    style={{
                      ...styles.typeBadge,
                      background: TYPE_COLORS[account.type],
                    }}
                  >
                    {TYPE_LABELS[account.type]}
                  </span>
                  <div style={styles.cardActions}>
                    <button
                      onClick={() => setEditing(account)}
                      style={styles.iconBtn}
                      title="Edit"
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(account)}
                      style={{ ...styles.iconBtn, color: "#dc2626" }}
                      title="Delete"
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p style={styles.accountName}>{account.name}</p>
                <p style={styles.balance}>
                  {account.currency}{" "}
                  {parseFloat(account.currentBalance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <AccountForm
          title="Add account"
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
          defaultCurrency={defaultCurrency}
        />
      )}

      {editing && (
        <AccountForm
          title="Edit account"
          initial={editing}
          onSubmit={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}

      {deleting && (
        <DeleteConfirmDialog
          name={deleting.name}
          onConfirm={handleDelete}
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
    maxWidth: "900px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1.5rem",
  },
  pageTitle: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  addBtn: {
    padding: "0.6rem 1.25rem",
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
  errorMsg: {
    color: "#dc2626",
    background: "#fef2f2",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    fontSize: "0.9rem",
  },
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    background: "var(--bg-card)",
    borderRadius: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  emptyTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--text-label)",
    margin: "0 0 0.5rem",
  },
  emptySub: {
    color: "var(--text-secondary)",
    margin: "0 0 1.5rem",
    fontSize: "0.95rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "1rem",
  },
  card: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "1.25rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid var(--border)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  typeBadge: {
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "0.2rem 0.6rem",
    borderRadius: "999px",
    color: "#374151",
  },
  cardActions: {
    display: "flex",
    gap: "0.5rem",
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "0.8rem",
    color: "#4f46e5",
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
  },
  accountName: {
    margin: "0 0 0.5rem",
    fontWeight: 600,
    fontSize: "1rem",
    color: "var(--text-primary)",
  },
  balance: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "var(--text-label)",
  },
};
