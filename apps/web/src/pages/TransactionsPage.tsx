import { useState, useEffect, useCallback } from "react";
import { listAccounts, type Account } from "../api/accounts.js";
import { listCategories, type Category } from "../api/categories.js";
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type Transaction,
} from "../api/transactions.js";
import { TransactionForm } from "../components/TransactionForm.js";
import { FilterBar, type Filters } from "../components/FilterBar.js";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog.js";

interface Props {
  onLogout: () => void;
  onNavigate: (page: "accounts") => void;
}

function formatAmount(amountStr: string): { display: string; positive: boolean } {
  const num = parseFloat(amountStr);
  const positive = num >= 0;
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return { display: positive ? `+${formatted}` : `-${formatted}`, positive };
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const group = map.get(tx.date) ?? [];
    group.push(tx);
    map.set(tx.date, group);
  }
  return [...map.entries()];
}

const EMPTY_FILTERS: Filters = { accountId: "", categoryId: "", startDate: "", endDate: "" };

export function TransactionsPage({ onLogout, onNavigate }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  useEffect(() => {
    Promise.all([listAccounts(), listCategories()])
      .then(([accs, cats]) => {
        setAccounts(accs);
        setCategories(cats);
      })
      .catch((e) => console.error("Failed to load accounts/categories:", e));
  }, []);

  const loadPage = useCallback(
    async (p: number, activeFilters: Filters, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listTransactions({
          page: p,
          limit: 50,
          accountId: activeFilters.accountId || undefined,
          categoryId: activeFilters.categoryId || undefined,
          startDate: activeFilters.startDate || undefined,
          endDate: activeFilters.endDate || undefined,
        });
        setTransactions((prev) => (append ? [...prev, ...res.data] : res.data));
        setPage(p);
        setHasMore(res.data.length === 50);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadPage(1, filters, false);
  }, [filters, loadPage]);

  function handleFiltersChange(updated: Filters) {
    setFilters(updated);
  }

  async function handleLoadMore() {
    await loadPage(page + 1, filters, true);
  }

  function handleAdd() {
    setEditTarget(null);
    setShowForm(true);
  }

  function handleEdit(tx: Transaction) {
    setEditTarget(tx);
    setShowForm(true);
  }

  async function handleSave(_tx: Transaction) {
    setShowForm(false);
    await loadPage(1, filters, false);
  }

  function handleDelete(tx: Transaction) {
    setDeleteTarget(tx);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await deleteTransaction(deleteTarget.id);
    setDeleteTarget(null);
    await loadPage(1, filters, false);
  }

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const grouped = groupByDate(transactions);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>BudgetApp</h1>
        <nav style={styles.nav}>
          <button style={{ ...styles.navBtn, ...styles.navBtnActive }} type="button">
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
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>Transactions</h2>
          <button onClick={handleAdd} style={styles.addBtn} type="button">
            + Add transaction
          </button>
        </div>

        <FilterBar
          accounts={accounts}
          categories={categories}
          filters={filters}
          onChange={handleFiltersChange}
        />

        {error && <p style={styles.errorMsg}>{error}</p>}

        {loading && transactions.length === 0 && (
          <p style={styles.status}>Loading transactions…</p>
        )}

        {!loading && transactions.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No transactions yet</p>
            <p style={styles.emptySub}>
              Add your first transaction to start tracking your finances.
            </p>
            <button onClick={handleAdd} style={styles.addBtn} type="button">
              + Add transaction
            </button>
          </div>
        )}

        {grouped.map(([date, txs]) => (
          <section key={date} style={styles.dateGroup}>
            <h3 style={styles.dateHeading}>{formatDateHeading(date)}</h3>
            {txs.map((tx) => {
              const account = accountMap.get(tx.accountId);
              const category = categoryMap.get(tx.categoryId ?? "");
              const { display, positive } = formatAmount(tx.amount);
              return (
                <div key={tx.id} style={styles.txRow}>
                  <div style={styles.txMain}>
                    <span style={styles.txDesc}>{tx.description}</span>
                    <div style={styles.txMeta}>
                      {category && (
                        <span
                          style={{
                            ...styles.categoryBadge,
                            background: category.color + "22",
                            color: category.color,
                            border: `1px solid ${category.color}55`,
                          }}
                        >
                          {category.icon} {category.name}
                        </span>
                      )}
                      <span style={styles.accountLabel}>
                        {account?.name ?? "Unknown account"}
                      </span>
                    </div>
                  </div>
                  <div style={styles.txRight}>
                    <span
                      style={{
                        ...styles.amount,
                        color: positive ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {display}
                    </span>
                    <div style={styles.txActions}>
                      <button
                        onClick={() => handleEdit(tx)}
                        style={styles.actionBtn}
                        title="Edit"
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tx)}
                        style={{ ...styles.actionBtn, color: "#dc2626" }}
                        title="Delete"
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {hasMore && !loading && (
          <div style={styles.loadMoreRow}>
            <button onClick={handleLoadMore} style={styles.loadMoreBtn} type="button">
              Load more
            </button>
          </div>
        )}

        {loading && transactions.length > 0 && (
          <p style={styles.status}>Loading more…</p>
        )}
      </main>

      {showForm && (
        <TransactionForm
          transaction={editTarget}
          accounts={accounts}
          categories={categories}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          onCreate={createTransaction}
          onUpdate={updateTransaction}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          name={deleteTarget.description}
          onConfirm={handleDeleteConfirm}
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
    transition: "background 0.15s",
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
  errorMsg: {
    color: "#dc2626",
    background: "#fef2f2",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    fontSize: "0.9rem",
    marginBottom: "1rem",
  },
  status: {
    color: "#6b7280",
    textAlign: "center",
    padding: "3rem 0",
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
  dateGroup: {
    marginBottom: "1.5rem",
  },
  dateHeading: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "0.375rem 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "0.5rem",
  },
  txRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.875rem 1rem",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    marginBottom: "0.375rem",
    gap: "1rem",
    transition: "box-shadow 0.15s",
  },
  txMain: {
    flex: 1,
    minWidth: 0,
  },
  txDesc: {
    display: "block",
    fontWeight: 500,
    color: "#1a1a2e",
    fontSize: "0.9375rem",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  txMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.375rem",
    marginTop: "0.25rem",
    alignItems: "center",
  },
  categoryBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.2rem",
    fontSize: "0.72rem",
    padding: "0.125rem 0.5rem",
    borderRadius: "999px",
    fontWeight: 600,
  },
  accountLabel: {
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
  txRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.375rem",
    flexShrink: 0,
  },
  amount: {
    fontWeight: 700,
    fontSize: "1rem",
    fontVariantNumeric: "tabular-nums",
  },
  txActions: {
    display: "flex",
    gap: "0.5rem",
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
  loadMoreRow: {
    display: "flex",
    justifyContent: "center",
    padding: "1.5rem 0",
  },
  loadMoreBtn: {
    padding: "0.625rem 2rem",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "#374151",
    fontWeight: 500,
  },
};
