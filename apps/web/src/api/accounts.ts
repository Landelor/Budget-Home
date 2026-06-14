import { apiFetch } from "./client.js";

export type AccountType = "checking" | "savings" | "credit" | "cash";

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  currentBalance: string;
  createdAt: string;
  deletedAt: string | null;
}

export function listAccounts(): Promise<Account[]> {
  return apiFetch<Account[]>("/accounts");
}

export function createAccount(body: {
  name: string;
  type: AccountType;
  currency?: string;
  initialBalance?: number;
}): Promise<Account> {
  return apiFetch<Account>("/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAccount(
  id: string,
  body: { name?: string; type?: AccountType },
): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAccount(id: string): Promise<void> {
  return apiFetch<void>(`/accounts/${id}`, { method: "DELETE" });
}
