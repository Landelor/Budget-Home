import { apiFetch } from "./client.js";

export type BudgetPeriod = "monthly" | "weekly";

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  period: BudgetPeriod;
  limitAmount: string;
  startDate: string;
  createdAt: string;
  currentSpend: string;
}

export interface DashboardSummary {
  totalBalance: string;
  totalSpentThisMonth: string;
  totalIncomeThisMonth: string;
}

export function listBudgets(): Promise<Budget[]> {
  return apiFetch<Budget[]>("/budgets");
}

export function createBudget(body: {
  categoryId: string;
  period: BudgetPeriod;
  limitAmount: number;
  startDate: string;
}): Promise<Budget> {
  return apiFetch<Budget>("/budgets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateBudget(id: string, body: { limitAmount: number }): Promise<Budget> {
  return apiFetch<Budget>(`/budgets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteBudget(id: string): Promise<void> {
  return apiFetch<void>(`/budgets/${id}`, { method: "DELETE" });
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/dashboard");
}
