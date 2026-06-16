import { useState, useEffect } from "react";
import { NavBar } from "../components/NavBar.js";
import { useExpenses } from "../hooks/useExpenses.js";
import type { ExpenseFrequency } from "../api/expenses.js";
import { getExchangeRates } from "../api/expenses.js";
import { getSettings } from "../api/settings.js";

interface OffsetItem {
  id: string;
  expenseId: string;
}

function loadOffsetItems(): OffsetItem[] {
  try {
    const raw = localStorage.getItem("expenses-offset-items");
    return raw ? (JSON.parse(raw) as OffsetItem[]) : [];
  } catch {
    return [];
  }
}

function saveOffsetItems(items: OffsetItem[]) {
  localStorage.setItem("expenses-offset-items", JSON.stringify(items));
}

function calcYearly(amount: string, frequency: ExpenseFrequency): number {
  const n = parseFloat(amount);
  if (frequency === "yearly") return n;
  if (frequency === "monthly") return n * 12;
  return n * 26;
}

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface Props {
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

export function OffsetPage({ onLogout, onNavigate }: Props) {
  const { expenses } = useExpenses();
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [offsetItems, setOffsetItems] = useState<OffsetItem[]>(loadOffsetItems);
  const [showSelect, setShowSelect] = useState(false);
  const [selectId, setSelectId] = useState<string>("");

  useEffect(() => {
    getSettings()
      .then((s) => setDefaultCurrency(s.defaultCurrency))
      .catch(() => {});
    getExchangeRates()
      .then(({ rates }) => setRates(rates))
      .catch(() => {});
  }, []);

  const sortedExpenses = [...expenses].sort((a, b) => a.name.localeCompare(b.name));

  function getOffsetYearly(expenseId: string): number {
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return 0;
    const expCurrency = exp.currency ?? defaultCurrency;
    const yearly = calcYearly(exp.amount, exp.frequency);
    const converted = rates ? convertAmount(yearly, expCurrency, defaultCurrency, rates) : yearly;
    return Math.ceil(converted / 100) * 100;
  }

  function addItem() {
    if (!selectId) return;
    const newItems = [...offsetItems, { id: `${Date.now()}-${Math.random()}`, expenseId: selectId }];
    setOffsetItems(newItems);
    saveOffsetItems(newItems);
    setSelectId("");
    setShowSelect(false);
  }

  function removeItem(id: string) {
    const newItems = offsetItems.filter((o) => o.id !== id);
    setOffsetItems(newItems);
    saveOffsetItems(newItems);
  }

  const rawTotalWeekly = offsetItems.reduce((sum, o) => sum + getOffsetYearly(o.expenseId) / 52, 0);
  const totalWeekly = Math.ceil(rawTotalWeekly / 10) * 10;

  return (
    <div style={styles.page}>
      <NavBar onLogout={onLogout} onNavigate={onNavigate} activePage="offset" />

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <h2 style={styles.pageTitle}>Offset</h2>
          <button
            style={styles.addBtn}
            type="button"
            onClick={() => { setShowSelect(true); setSelectId(sortedExpenses[0]?.id ?? ""); }}
          >
            + Add
          </button>
        </div>

        {/* Offset Amount card */}
        <div style={styles.amountCard}>
          <div style={styles.amountLabel}>Offset Amount</div>
          <div style={styles.amountValue}>{fmt(totalWeekly, defaultCurrency)}</div>
          <div style={styles.amountSub}>per week</div>
        </div>

        {/* Add selector */}
        {showSelect && (
          <div style={styles.selectRow}>
            <select
              style={styles.select}
              value={selectId}
              onChange={(e) => setSelectId(e.target.value)}
            >
              {sortedExpenses.map((exp) => (
                <option key={exp.id} value={exp.id}>{exp.name}</option>
              ))}
            </select>
            <button style={styles.confirmBtn} type="button" onClick={addItem}>Add</button>
            <button style={styles.cancelBtn} type="button" onClick={() => setShowSelect(false)}>Cancel</button>
          </div>
        )}

        {/* Offset table */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Expense</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Yearly ({defaultCurrency})</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Weekly ({defaultCurrency})</th>
                <th style={{ ...styles.th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {offsetItems.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...styles.td, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    No items yet. Click + Add to select an expense.
                  </td>
                </tr>
              )}
              {offsetItems.map((item) => {
                const exp = expenses.find((e) => e.id === item.expenseId);
                if (!exp) return null;
                const yearly = getOffsetYearly(item.expenseId);
                const weekly = yearly / 52;
                return (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>{exp.name}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmt(yearly, defaultCurrency)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmt(weekly, defaultCurrency)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button
                        style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                        type="button"
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
    maxWidth: "800px",
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
  amountCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    textAlign: "center",
    maxWidth: "300px",
  },
  amountLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
    marginBottom: "0.35rem",
  },
  amountValue: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  amountSub: {
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    marginTop: "0.15rem",
  },
  selectRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    marginBottom: "1rem",
    flexWrap: "wrap" as const,
  },
  select: {
    flex: "1 1 200px",
    padding: "0.5rem 0.75rem",
    borderRadius: "7px",
    border: "1px solid var(--border)",
    fontSize: "0.9rem",
    background: "var(--bg-page)",
    color: "var(--text-primary)",
    cursor: "pointer",
  },
  confirmBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
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
  },
  deleteBtn: {
    color: "#dc2626",
    borderColor: "#fca5a5",
  },
};
