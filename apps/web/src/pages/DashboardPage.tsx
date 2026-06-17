import { useState, useEffect } from "react";
import { NavBar } from "../components/NavBar.js";
import { useExpenses } from "../hooks/useExpenses.js";
import { listUtilities } from "../api/utilities.js";
import type { Utility, UtilityType } from "../api/utilities.js";
import { getExchangeRates } from "../api/expenses.js";
import type { ExpenseFrequency } from "../api/expenses.js";
import { getSettings } from "../api/settings.js";
import { listIncomes, listIncomePersons } from "../api/income.js";
import type { Income, IncomePerson } from "../api/income.js";

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

export function DashboardPage({ onLogout, onNavigate }: Props) {
  const { expenses, loading: expensesLoading } = useExpenses();
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesDate, setRatesDate] = useState<string | null>(null);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [incomePersons, setIncomePersons] = useState<IncomePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [fireExtPct, setFireExtPct] = useState<number>(() => {
    const saved = localStorage.getItem("dashboard-fire-ext-pct");
    return saved ? parseInt(saved, 10) : 10;
  });
  const [smilePct, setSmilePct] = useState<number>(() => {
    const saved = localStorage.getItem("dashboard-smile-pct");
    return saved ? parseInt(saved, 10) : 10;
  });

  const offsetItems = loadOffsetItems();

  useEffect(() => {
    Promise.all([
      getSettings().then((s) => setDefaultCurrency(s.defaultCurrency)).catch(() => {}),
      getExchangeRates()
        .then(({ rates, date }) => {
          setRates(rates);
          setRatesDate(date);
        })
        .catch(() => {}),
      listUtilities().then(setUtilities).catch(() => {}),
      listIncomes().then(setIncomes).catch(() => {}),
      listIncomePersons().then(setIncomePersons).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  function getOffsetYearly(expenseId: string): number {
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return 0;
    const expCurrency = exp.currency ?? defaultCurrency;
    const yearly = calcYearly(exp.amount, exp.frequency);
    const converted = rates ? convertAmount(yearly, expCurrency, defaultCurrency, rates) : yearly;
    return Math.ceil(converted / 100) * 100;
  }

  const rawTotalWeekly = offsetItems.reduce((sum, o) => sum + getOffsetYearly(o.expenseId) / 52, 0);
  const offsetWeekly = Math.ceil(rawTotalWeekly / 10) * 10;

  function utilityStats(type: UtilityType) {
    const rows = utilities.filter((u) => u.type === type);
    if (rows.length === 0) return null;
    const avgAmount =
      rows.reduce((s, u) => {
        const raw = parseFloat(u.amount);
        const cur = u.currency ?? defaultCurrency;
        return s + (rates ? convertAmount(raw, cur, defaultCurrency, rates) : raw);
      }, 0) / rows.length;
    const avgDays = rows.reduce((s, u) => s + u.serviceDays, 0) / rows.length;
    const perDay = avgAmount / avgDays;
    const perFortnight = perDay * 14;
    return { perDay, perFortnight };
  }

  const foreignCurrencies = [
    ...new Set(
      expenses.map((e) => e.currency ?? defaultCurrency).filter((c) => c !== defaultCurrency),
    ),
  ];

  const avgIncomeByPerson: { id: string; name: string; avg: number; count: number }[] = (() => {
    const personMap = Object.fromEntries(incomePersons.map((p) => [p.id, p.name]));
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const inc of incomes) {
      if (!inc.personId) continue;
      const cur = inc.currency ?? defaultCurrency;
      const amount = parseFloat(inc.amount);
      const converted = rates ? convertAmount(amount, cur, defaultCurrency, rates) : amount;
      const entry = totals[inc.personId] ?? { sum: 0, count: 0 };
      entry.sum += converted;
      entry.count += 1;
      totals[inc.personId] = entry;
    }
    return Object.entries(totals)
      .map(([id, { sum, count }]) => ({ id, name: personMap[id] ?? id, avg: sum / count, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const totalAvgIncome = avgIncomeByPerson.reduce((sum, p) => sum + p.avg, 0);

  const isLoading = loading || expensesLoading;

  return (
    <div style={styles.page}>
      <NavBar onLogout={onLogout} onNavigate={onNavigate} activePage="dashboard" />

      <main style={styles.main}>
        {isLoading && <p style={styles.status}>Loading…</p>}

        {!isLoading && (
          <>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <p style={styles.summaryLabel}>Offset Amount</p>
                <p style={styles.summaryValue}>{fmt(offsetWeekly, defaultCurrency)}</p>
                <p style={styles.summarySubLabel}>per week</p>
              </div>

              {(["gas", "power", "water"] as UtilityType[]).map((type) => {
                const stats = utilityStats(type);
                if (!stats) return null;
                const label = type.charAt(0).toUpperCase() + type.slice(1);
                return (
                  <div key={type} style={styles.summaryCard}>
                    <p style={styles.summaryLabel}>{label}</p>
                    <p style={styles.summaryValue}>{fmt(stats.perFortnight, defaultCurrency)}</p>
                    <p style={styles.summarySubLabel}>
                      per fortnight &middot; {fmt(stats.perDay, defaultCurrency)}/day
                    </p>
                  </div>
                );
              })}
            </div>

            {avgIncomeByPerson.length > 0 && (
              <div style={styles.ratesCard}>
                <div style={styles.ratesCardHeader}>
                  <span style={styles.ratesCardTitle}>Avg Income Per Person</span>
                  <span style={styles.ratesCardDate}>average entry amount · {defaultCurrency}</span>
                </div>
                <div style={styles.incomePersonList}>
                  {avgIncomeByPerson.map(({ id, name, avg, count }) => (
                    <div key={id} style={styles.incomePersonRow}>
                      <span style={styles.incomePersonName}>{name}</span>
                      <span style={styles.incomePersonAvg}>{fmt(avg, defaultCurrency)}</span>
                      <span style={styles.incomePersonCount}>
                        {count} {count === 1 ? "entry" : "entries"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {avgIncomeByPerson.length > 0 && (
              <div style={styles.ratesCard}>
                <div style={styles.ratesCardHeader}>
                  <span style={styles.ratesCardTitle}>Allocation</span>
                  <span style={styles.ratesCardDate}>% of combined avg income</span>
                </div>
                <div style={styles.incomePersonList}>
                  {(
                    [
                      { label: "Fire Extinguisher", pct: fireExtPct, key: "dashboard-fire-ext-pct", set: setFireExtPct },
                      { label: "Smile", pct: smilePct, key: "dashboard-smile-pct", set: setSmilePct },
                    ] as const
                  ).map(({ label, pct, key, set }) => (
                    <div key={label} style={styles.allocationRow}>
                      <span style={styles.incomePersonName}>{label}</span>
                      <select
                        style={styles.pctSelect}
                        value={pct}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          localStorage.setItem(key, String(v));
                          set(v);
                        }}
                      >
                        {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80].map((p) => (
                          <option key={p} value={p}>{p}%</option>
                        ))}
                      </select>
                      <span style={styles.incomePersonAvg}>
                        {fmt((totalAvgIncome * pct) / 100 / 2, defaultCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {foreignCurrencies.length > 0 && rates && (
              <div style={styles.ratesCard}>
                <div style={styles.ratesCardHeader}>
                  <span style={styles.ratesCardTitle}>Exchange Rates</span>
                  {ratesDate && (
                    <span style={styles.ratesCardDate}>
                      Rates as of {ratesDate} (base: {defaultCurrency})
                    </span>
                  )}
                </div>
                <div style={styles.ratesGrid}>
                  {foreignCurrencies.map((c) => {
                    const fromRate = rates[c];
                    const toRate = rates[defaultCurrency];
                    if (!fromRate || !toRate) return null;
                    const rate = toRate / fromRate;
                    return (
                      <div key={c} style={styles.rateItem}>
                        <span style={styles.rateCurrency}>{c}</span>
                        <span style={styles.rateArrow}>→</span>
                        <span style={styles.rateValue}>
                          {rate.toFixed(4)} {defaultCurrency}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
  main: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
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
    margin: "0 0 0.2rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  summarySubLabel: {
    margin: 0,
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
  },
  ratesCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "1rem 1.25rem",
    marginBottom: "1.5rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  ratesCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  ratesCardTitle: {
    fontSize: "0.85rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
  },
  ratesCardDate: {
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
  },
  ratesGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.75rem",
  },
  rateItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "0.4rem 0.875rem",
    fontSize: "0.875rem",
  },
  rateCurrency: {
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  rateArrow: {
    color: "var(--text-secondary)",
  },
  rateValue: {
    color: "var(--text-primary)",
  },
  status: {
    color: "var(--text-secondary)",
    textAlign: "center",
    padding: "3rem 0",
  },
  incomePersonList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  incomePersonRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.5rem 0.75rem",
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "0.875rem",
  },
  incomePersonName: {
    flex: 1,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  incomePersonAvg: {
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  incomePersonCount: {
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
    minWidth: "56px",
    textAlign: "right" as const,
  },
  allocationRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.5rem 0.75rem",
    background: "var(--bg-page)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "0.875rem",
  },
  pctSelect: {
    padding: "0.3rem 0.5rem",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    fontSize: "0.85rem",
    background: "var(--bg-page)",
    color: "var(--text-primary)",
    cursor: "pointer",
  },
};
