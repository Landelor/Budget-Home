import { useState, useEffect } from "react";
import { listCategories, type Category } from "../api/categories.js";
import { useBudgets } from "../hooks/useBudgets.js";
import { BudgetForm } from "../components/BudgetForm.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";
import type { Budget, BudgetPeriod } from "../api/budgets.js";

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

function ProgressBar({ pct, overBudget }: { pct: number; overBudget: boolean }) {
  const fill = Math.min(pct, 100);
  return (
    <div style={styles.barTrack}>
      <div
        style={{
          ...styles.barFill,
          width: `${fill}%`,
          background: overBudget ? "#dc2626" : pct >= 80 ? "#f59e0b" : "#4f46e5",
        }}
      />
    </div>
  );
}

export function DashboardPage({ onLogout, onNavigate }: Props) {
  const { budgets, summary, loading, error, add, edit, remove, refresh } = useBudgets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Budget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((e) => console.error("Failed to load categories:", e));
  }, []);

  async function handleCreate(categoryId: string, period: BudgetPeriod, limitAmount: number) {
    await add(categoryId, period, limitAmount);
    setShowCreate(false);
    refresh();
  }

  async function handleEdit(categoryId: string, _period: BudgetPeriod, limitAmount: number) {
    if (!editTarget) return;
    await edit(editTarget.id, limitAmount);
    setEditTarget(null);
    refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.limitAmount), 0);
  const totalSpend = budgets.reduce((sum, b) => sum + parseFloat(b.currentSpend), 0);
  const overBudgetCount = budgets.filter(
    (b) => parseFloat(b.currentSpend) > parseFloat(b.limitAmount),
  ).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>BudgetApp</h1>
        <nav style={styles.nav}>
          <button
            style={{ ...styles.navBtn, ...styles.navBtnActive }}
            type="button"
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
            style={styles.navBtn}
            type="button"
            onClick={() => onNavigate("accounts")}
          >
            Accounts
          </button>
        </nav>
        <button onClick={onLogout} style={styles.logoutBtn} type="button">
          Sign out
        </button>
      </header>

      <main style={styles.main}>
        {/* Summary cards */}
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
            <p style={styles.summaryLabel}>Budget utilisation</p>
            <p style={styles.summaryValue}>
              {budgets.length === 0
                ? "—"
                : `${fmt(totalSpend)} / ${fmt(totalBudget)}`}
            </p>
          </div>
          {overBudgetCount > 0 && (
            <div style={{ ...styles.summaryCard, ...styles.overBudgetCard }}>
              <p style={styles.summaryLabel}>Over budget</p>
              <p style={{ ...styles.summaryValue, color: "#dc2626" }}>
                {overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"}
              </p>
            </div>
          )}
        </div>

        {/* Budget list */}
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>Budgets</h2>
          <button onClick={() => setShowCreate(true)} style={styles.addBtn} type="button">
            + Add budget
          </button>
        </div>

        {loading && <p style={styles.status}>Loading…</p>}
        {error && <p style={styles.errorMsg}>{error}</p>}

        {!loading && !error && budgets.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No budgets yet</p>
            <p style={styles.emptySub}>
              Create your first budget to start tracking spending by category.
            </p>
            <button onClick={() => setShowCreate(true)} style={styles.addBtn} type="button">
              + Add budget
            </button>
          </div>
        )}

        {budgets.map((budget) => {
          const spend = parseFloat(budget.currentSpend);
          const limit = parseFloat(budget.limitAmount);
          const pct = limit > 0 ? (spend / limit) * 100 : 0;
          const overBudget = spend > limit;
          const remaining = limit - spend;

          return (
            <div
              key={budget.id}
              style={{
                ...styles.budgetCard,
                borderColor: overBudget ? "#fca5a5" : "#e5e7eb",
                background: overBudget ? "#fff8f8" : "#fff",
              }}
            >
              <div style={styles.budgetTop}>
                <div style={styles.budgetInfo}>
                  <span
                    style={{
                      ...styles.catBadge,
                      background: budget.categoryColor + "22",
                      color: budget.categoryColor,
                      border: `1px solid ${budget.categoryColor}55`,
                    }}
                  >
                    {budget.categoryIcon} {budget.categoryName}
                  </span>
                  <span style={styles.periodBadge}>
                    {budget.period === "monthly" ? "Monthly" : "Weekly"}
                  </span>
                  {overBudget && (
                    <span style={styles.overBudgetBadge}>Over budget</span>
                  )}
                </div>
                <div style={styles.budgetActions}>
                  <button
                    onClick={() => setEditTarget(budget)}
                    style={styles.actionBtn}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(budget)}
                    style={{ ...styles.actionBtn, color: "#dc2626" }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <ProgressBar pct={pct} overBudget={overBudget} />

              <div style={styles.budgetAmounts}>
                <span style={styles.spendLabel}>
                  <span style={{ color: overBudget ? "#dc2626" : "#374151", fontWeight: 600 }}>
                    {fmt(spend)}
                  </span>
                  {" spent of "}
                  <span style={{ fontWeight: 600 }}>{fmt(limit)}</span>
                </span>
                <span
                  style={{
                    ...styles.remainingLabel,
                    color: overBudget ? "#dc2626" : "#16a34a",
                  }}
                >
                  {overBudget
                    ? `${fmt(Math.abs(remaining))} over`
                    : `${fmt(remaining)} left`}
                </span>
              </div>

              <div style={styles.pctRow}>
                <span style={{ color: overBudget ? "#dc2626" : "#6b7280", fontSize: "0.8rem" }}>
                  {Math.round(pct)}% used
                </span>
              </div>
            </div>
          );
        })}
      </main>

      {showCreate && (
        <BudgetForm
          categories={categories}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {editTarget && (
        <BudgetForm
          budget={editTarget}
          categories={categories}
          onSubmit={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          name={`${deleteTarget.categoryIcon} ${deleteTarget.categoryName} (${deleteTarget.period})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  summaryCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "1.25rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb",
  },
  overBudgetCard: {
    borderColor: "#fca5a5",
    background: "#fff8f8",
  },
  summaryLabel: {
    margin: "0 0 0.375rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  summaryValue: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#1a1a2e",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1.25rem",
  },
  pageTitle: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#1a1a2e",
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
    color: "#6b7280",
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
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  emptyTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 0.5rem",
  },
  emptySub: {
    color: "#6b7280",
    margin: "0 0 1.5rem",
    fontSize: "0.95rem",
  },
  budgetCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "1.25rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb",
    marginBottom: "0.875rem",
  },
  budgetTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "0.875rem",
  },
  budgetInfo: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    alignItems: "center",
  },
  catBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.2rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    padding: "0.2rem 0.6rem",
    borderRadius: "999px",
  },
  periodBadge: {
    fontSize: "0.75rem",
    color: "#6b7280",
    background: "#f3f4f6",
    padding: "0.2rem 0.5rem",
    borderRadius: "999px",
    fontWeight: 500,
  },
  overBudgetBadge: {
    fontSize: "0.75rem",
    color: "#dc2626",
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    padding: "0.2rem 0.5rem",
    borderRadius: "999px",
    fontWeight: 600,
  },
  budgetActions: {
    display: "flex",
    gap: "0.5rem",
    flexShrink: 0,
  },
  actionBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "0.8rem",
    color: "#4f46e5",
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
  },
  barTrack: {
    height: "8px",
    background: "#f3f4f6",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "0.625rem",
  },
  barFill: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.3s ease",
  },
  budgetAmounts: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.875rem",
    color: "#374151",
  },
  spendLabel: {
    color: "#374151",
    fontSize: "0.875rem",
  },
  remainingLabel: {
    fontWeight: 600,
    fontSize: "0.875rem",
  },
  pctRow: {
    marginTop: "0.25rem",
  },
};
