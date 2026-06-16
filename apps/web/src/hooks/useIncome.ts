import { useState, useEffect, useCallback } from "react";
import {
  listIncomes,
  listIncomePersons,
  createIncome,
  updateIncome,
  deleteIncome,
  createIncomePerson,
  deleteIncomePerson,
  type Income,
  type IncomePerson,
  type IncomeFrequency,
} from "../api/income.js";

interface IncomeState {
  incomes: Income[];
  persons: IncomePerson[];
  loading: boolean;
  error: string | null;
}

export function useIncome() {
  const [state, setState] = useState<IncomeState>({
    incomes: [],
    persons: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [incomes, persons] = await Promise.all([listIncomes(), listIncomePersons()]);
      setState({ incomes, persons, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string, date: string, amount: number, frequency: IncomeFrequency, currency: string, personId?: string) => {
      const income = await createIncome({ name, date, amount, frequency, currency, ...(personId ? { personId } : {}) });
      setState((s) => ({ ...s, incomes: [...s.incomes, income] }));
    },
    [],
  );

  const edit = useCallback(
    async (id: string, name: string, date: string, amount: number, frequency: IncomeFrequency, currency: string, personId: string | null) => {
      const updated = await updateIncome(id, { name, date, amount, frequency, currency, personId });
      setState((s) => ({ ...s, incomes: s.incomes.map((i) => (i.id === id ? updated : i)) }));
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteIncome(id);
    setState((s) => ({ ...s, incomes: s.incomes.filter((i) => i.id !== id) }));
  }, []);

  const addPerson = useCallback(async (name: string) => {
    const person = await createIncomePerson({ name });
    setState((s) => ({ ...s, persons: [...s.persons, person] }));
    return person;
  }, []);

  const removePerson = useCallback(async (id: string) => {
    await deleteIncomePerson(id);
    setState((s) => ({ ...s, persons: s.persons.filter((p) => p.id !== id) }));
  }, []);

  return { ...state, refresh, add, edit, remove, addPerson, removePerson };
}
