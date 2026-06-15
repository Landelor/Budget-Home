import { useState, useEffect, useCallback } from "react";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  type Expense,
  type ExpenseFrequency,
} from "../api/expenses.js";

interface ExpensesState {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
}

export function useExpenses() {
  const [state, setState] = useState<ExpensesState>({
    expenses: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const expenses = await listExpenses();
      setState({ expenses, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string, amount: number, frequency: ExpenseFrequency) => {
      const expense = await createExpense({ name, amount, frequency });
      setState((s) => ({ ...s, expenses: [...s.expenses, expense] }));
    },
    [],
  );

  const edit = useCallback(
    async (id: string, name: string, amount: number, frequency: ExpenseFrequency) => {
      const updated = await updateExpense(id, { name, amount, frequency });
      setState((s) => ({
        ...s,
        expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
      }));
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteExpense(id);
    setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
  }, []);

  return { ...state, refresh, add, edit, remove };
}
