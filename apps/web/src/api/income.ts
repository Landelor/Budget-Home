import { apiFetch } from "./client.js";

export type IncomeFrequency = "fortnightly" | "monthly" | "yearly";

export interface IncomePerson {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Income {
  id: string;
  userId: string;
  personId: string | null;
  name: string;
  amount: string;
  currency: string;
  frequency: IncomeFrequency;
  createdAt: string;
}

export function listIncomePersons(): Promise<IncomePerson[]> {
  return apiFetch<IncomePerson[]>("/income/persons");
}

export function createIncomePerson(body: { name: string }): Promise<IncomePerson> {
  return apiFetch<IncomePerson>("/income/persons", { method: "POST", body: JSON.stringify(body) });
}

export function deleteIncomePerson(id: string): Promise<void> {
  return apiFetch<void>(`/income/persons/${id}`, { method: "DELETE" });
}

export function listIncomes(): Promise<Income[]> {
  return apiFetch<Income[]>("/income");
}

export function createIncome(body: {
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  currency: string;
  personId?: string;
}): Promise<Income> {
  return apiFetch<Income>("/income", { method: "POST", body: JSON.stringify(body) });
}

export function updateIncome(
  id: string,
  body: { name?: string; amount?: number; frequency?: IncomeFrequency; currency?: string; personId?: string | null },
): Promise<Income> {
  return apiFetch<Income>(`/income/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteIncome(id: string): Promise<void> {
  return apiFetch<void>(`/income/${id}`, { method: "DELETE" });
}
