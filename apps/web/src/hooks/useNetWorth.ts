import { useState, useEffect, useCallback } from "react";
import {
  listNetWorthEntries,
  createNetWorthEntry,
  updateNetWorthEntry,
  deleteNetWorthEntry,
  getNetWorthSummary,
  type NetWorthEntry,
  type NetWorthMonthSummary,
  type NetWorthType,
} from "../api/netWorth.js";

interface NetWorthState {
  entries: NetWorthEntry[];
  summary: NetWorthMonthSummary[];
  loading: boolean;
  error: string | null;
}

export function useNetWorth() {
  const [state, setState] = useState<NetWorthState>({
    entries: [],
    summary: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [entries, summary] = await Promise.all([listNetWorthEntries(), getNetWorthSummary()]);
      setState({ entries, summary, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (type: NetWorthType, description: string, amount: number, month: string) => {
    const entry = await createNetWorthEntry({ type, description, amount, month });
    setState((s) => ({ ...s, entries: [...s.entries, entry] }));
    await refresh();
    return entry;
  }, [refresh]);

  const edit = useCallback(
    async (id: string, type: NetWorthType, description: string, amount: number, month: string) => {
      const updated = await updateNetWorthEntry(id, { type, description, amount, month });
      setState((s) => ({ ...s, entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(async (id: string) => {
    await deleteNetWorthEntry(id);
    setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
    await refresh();
  }, [refresh]);

  return { ...state, refresh, add, edit, remove };
}
