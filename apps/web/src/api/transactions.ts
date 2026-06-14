import { apiFetch } from "./client.js";

export interface Transaction {
  id: string;
  accountId: string;
  userId: string;
  amount: string;
  date: string;
  description: string;
  categoryId: string | null;
  isRecurring: boolean;
  createdAt: string;
  deletedAt: string | null;
}

export interface TransactionListResponse {
  data: Transaction[];
  page: number;
  limit: number;
}

export interface CreateTransactionInput {
  accountId: string;
  amount: number;
  date: string;
  description: string;
  categoryId?: string;
  isRecurring?: boolean;
}

export interface UpdateTransactionInput {
  description?: string;
  categoryId?: string | null;
  date?: string;
  amount?: number;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function listTransactions(filters: TransactionFilters = {}): Promise<TransactionListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return apiFetch<TransactionListResponse>(`/transactions${qs ? `?${qs}` : ""}`);
}

export function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  return apiFetch<Transaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
  return apiFetch<Transaction>(`/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(id: string): Promise<void> {
  return apiFetch<void>(`/transactions/${id}`, { method: "DELETE" });
}

export interface ImportTransactionRow {
  date: string;
  description: string;
  amount: number;
}

export interface ImportTransactionsResponse {
  imported: number;
}

export function importTransactions(
  accountId: string,
  transactions: ImportTransactionRow[],
): Promise<ImportTransactionsResponse> {
  return apiFetch<ImportTransactionsResponse>("/transactions/import", {
    method: "POST",
    body: JSON.stringify({ accountId, transactions }),
  });
}
