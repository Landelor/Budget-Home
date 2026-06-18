import type { Account } from "../api/accounts.js";
import type { Category } from "../api/categories.js";

export interface Filters {
  accountId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
}

interface Props {
  accounts: Account[];
  categories: Category[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function FilterBar({ accounts, categories, filters, onChange }: Props) {
  const hasActive =
    filters.accountId || filters.categoryId || filters.startDate || filters.endDate;

  function update(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div style={styles.bar}>
      <select
        value={filters.accountId}
        onChange={(e) => update("accountId", e.target.value)}
        style={styles.select}
        aria-label="Filter by account"
      >
        <option value="">All accounts</option>
        {accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.name}
          </option>
        ))}
      </select>

      <select
        value={filters.categoryId}
        onChange={(e) => update("categoryId", e.target.value)}
        style={styles.select}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.icon} {cat.name}
          </option>
        ))}
      </select>

      <label style={styles.dateLabel}>
        From
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => update("startDate", e.target.value)}
          style={styles.dateInput}
          aria-label="Start date"
        />
      </label>

      <label style={styles.dateLabel}>
        To
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => update("endDate", e.target.value)}
          style={styles.dateInput}
          aria-label="End date"
        />
      </label>

      {hasActive && (
        <button
          type="button"
          onClick={() =>
            onChange({ accountId: "", categoryId: "", startDate: "", endDate: "" })
          }
          style={styles.clearBtn}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    alignItems: "center",
    padding: "0.75rem 1rem",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    marginBottom: "1.25rem",
  },
  select: {
    padding: "0.4rem 0.6rem",
    border: "1px solid var(--border-input)",
    borderRadius: "6px",
    fontSize: "0.875rem",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    cursor: "pointer",
  },
  dateLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  dateInput: {
    padding: "0.375rem 0.5rem",
    border: "1px solid var(--border-input)",
    borderRadius: "6px",
    fontSize: "0.875rem",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
  },
  clearBtn: {
    padding: "0.375rem 0.75rem",
    border: "1px solid var(--border-input)",
    borderRadius: "6px",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    marginLeft: "auto",
  },
};
