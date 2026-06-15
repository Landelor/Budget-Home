import { apiFetch } from "./client.js";

export type UtilityType = "gas" | "power" | "water";

export interface Utility {
  id: string;
  userId: string;
  type: UtilityType;
  date: string;
  amount: string;
  currency: string;
  serviceDays: number;
  createdAt: string;
}

export function listUtilities(): Promise<Utility[]> {
  return apiFetch<Utility[]>("/utilities");
}

export function createUtility(body: {
  type: UtilityType;
  date: string;
  amount: number;
  serviceDays: number;
  currency: string;
}): Promise<Utility> {
  return apiFetch<Utility>("/utilities", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateUtility(
  id: string,
  body: { date?: string; amount?: number; serviceDays?: number; currency?: string },
): Promise<Utility> {
  return apiFetch<Utility>(`/utilities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteUtility(id: string): Promise<void> {
  return apiFetch<void>(`/utilities/${id}`, { method: "DELETE" });
}
