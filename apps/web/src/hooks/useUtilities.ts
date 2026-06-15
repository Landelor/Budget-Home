import { useState, useEffect, useCallback } from "react";
import {
  listUtilities,
  createUtility,
  updateUtility,
  deleteUtility,
  type Utility,
  type UtilityType,
} from "../api/utilities.js";

interface UtilitiesState {
  utilities: Utility[];
  loading: boolean;
  error: string | null;
}

export function useUtilities() {
  const [state, setState] = useState<UtilitiesState>({
    utilities: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const utilities = await listUtilities();
      setState({ utilities, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (type: UtilityType, date: string, amount: number, serviceDays: number) => {
      const utility = await createUtility({ type, date, amount, serviceDays });
      setState((s) => ({ ...s, utilities: [...s.utilities, utility] }));
    },
    [],
  );

  const edit = useCallback(
    async (id: string, date: string, amount: number, serviceDays: number) => {
      const updated = await updateUtility(id, { date, amount, serviceDays });
      setState((s) => ({
        ...s,
        utilities: s.utilities.map((u) => (u.id === id ? updated : u)),
      }));
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteUtility(id);
    setState((s) => ({ ...s, utilities: s.utilities.filter((u) => u.id !== id) }));
  }, []);

  return { ...state, refresh, add, edit, remove };
}
