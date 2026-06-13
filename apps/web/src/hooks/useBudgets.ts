import { useState, useEffect, useCallback } from "react";
import {
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getDashboardSummary,
  type Budget,
  type BudgetPeriod,
  type DashboardSummary,
} from "../api/budgets.js";

interface BudgetsState {
  budgets: Budget[];
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
}

function currentPeriodStart(period: BudgetPeriod): string {
  const now = new Date();
  if (period === "monthly") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  // ISO week starts Monday
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export function useBudgets() {
  const [state, setState] = useState<BudgetsState>({
    budgets: [],
    summary: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [budgets, summary] = await Promise.all([listBudgets(), getDashboardSummary()]);
      setState({ budgets, summary, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (categoryId: string, period: BudgetPeriod, limitAmount: number) => {
      const budget = await createBudget({
        categoryId,
        period,
        limitAmount,
        startDate: currentPeriodStart(period),
      });
      setState((s) => ({ ...s, budgets: [...s.budgets, budget] }));
    },
    [],
  );

  const edit = useCallback(async (id: string, limitAmount: number) => {
    const updated = await updateBudget(id, { limitAmount });
    setState((s) => ({
      ...s,
      budgets: s.budgets.map((b) => (b.id === id ? updated : b)),
    }));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteBudget(id);
    setState((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) }));
  }, []);

  return { ...state, refresh, add, edit, remove };
}
