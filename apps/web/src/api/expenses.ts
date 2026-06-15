import { apiFetch } from "./client.js";

export type ExpenseFrequency = "fortnightly" | "monthly" | "yearly";

export interface Expense {
  id: string;
  userId: string;
  name: string;
  amount: string;
  frequency: ExpenseFrequency;
  createdAt: string;
}

export function listExpenses(): Promise<Expense[]> {
  return apiFetch<Expense[]>("/expenses");
}

export function createExpense(body: {
  name: string;
  amount: number;
  frequency: ExpenseFrequency;
}): Promise<Expense> {
  return apiFetch<Expense>("/expenses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateExpense(
  id: string,
  body: { name?: string; amount?: number; frequency?: ExpenseFrequency },
): Promise<Expense> {
  return apiFetch<Expense>(`/expenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteExpense(id: string): Promise<void> {
  return apiFetch<void>(`/expenses/${id}`, { method: "DELETE" });
}
