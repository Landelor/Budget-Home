import { apiFetch } from "./client.js";

export interface OffsetItem {
  id: string;
  userId: string;
  expenseId: string;
  createdAt: string;
}

export function listOffsetItems(): Promise<OffsetItem[]> {
  return apiFetch<OffsetItem[]>("/offset-items");
}

export function createOffsetItem(expenseId: string): Promise<OffsetItem> {
  return apiFetch<OffsetItem>("/offset-items", {
    method: "POST",
    body: JSON.stringify({ expenseId }),
  });
}

export function deleteOffsetItem(id: string): Promise<void> {
  return apiFetch<void>(`/offset-items/${id}`, { method: "DELETE" });
}
