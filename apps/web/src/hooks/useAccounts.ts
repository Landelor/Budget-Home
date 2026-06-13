import { useState, useEffect, useCallback } from "react";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  type Account,
  type AccountType,
} from "../api/accounts.js";

interface AccountsState {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

export function useAccounts() {
  const [state, setState] = useState<AccountsState>({
    accounts: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const accounts = await listAccounts();
      setState({ accounts, loading: false, error: null });
    } catch (e) {
      setState({ accounts: [], loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string, type: AccountType, initialBalance: number) => {
      const account = await createAccount({ name, type, initialBalance });
      setState((s) => ({ ...s, accounts: [...s.accounts, account] }));
    },
    [],
  );

  const edit = useCallback(
    async (id: string, name: string, type: AccountType) => {
      const updated = await updateAccount(id, { name, type });
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) => (a.id === id ? updated : a)),
      }));
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteAccount(id);
    setState((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }));
  }, []);

  return { ...state, refresh, add, edit, remove };
}
