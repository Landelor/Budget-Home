import { useState, useEffect, useCallback } from "react";
import { listOffsetItems, createOffsetItem, deleteOffsetItem, type OffsetItem } from "../api/offsetItems.js";

interface OffsetItemsState {
  offsetItems: OffsetItem[];
  loading: boolean;
  error: string | null;
}

export function useOffsetItems() {
  const [state, setState] = useState<OffsetItemsState>({
    offsetItems: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const offsetItems = await listOffsetItems();
      setState({ offsetItems, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (expenseId: string) => {
    const item = await createOffsetItem(expenseId);
    setState((s) => ({ ...s, offsetItems: [...s.offsetItems, item] }));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteOffsetItem(id);
    setState((s) => ({ ...s, offsetItems: s.offsetItems.filter((o) => o.id !== id) }));
  }, []);

  return { ...state, refresh, add, remove };
}
