import { apiFetch } from "./client.js";

export type NetWorthSection = "asset" | "liability";
export type NetWorthType = "property" | "shares" | "bank_account" | "super" | "loan";

export interface NetWorthEntry {
  id: string;
  userId: string;
  section: NetWorthSection;
  type: NetWorthType;
  description: string;
  amount: string;
  month: string;
  createdAt: string;
}

export interface NetWorthMonthSummary {
  month: string;
  totalAssets: string;
  totalLiabilities: string;
  netPosition: string;
}

export function listNetWorthEntries(): Promise<NetWorthEntry[]> {
  return apiFetch<NetWorthEntry[]>("/net-worth/entries");
}

export function createNetWorthEntry(body: {
  type: NetWorthType;
  description: string;
  amount: number;
  month: string;
}): Promise<NetWorthEntry> {
  return apiFetch<NetWorthEntry>("/net-worth/entries", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateNetWorthEntry(
  id: string,
  body: { type?: NetWorthType; description?: string; amount?: number; month?: string },
): Promise<NetWorthEntry> {
  return apiFetch<NetWorthEntry>(`/net-worth/entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteNetWorthEntry(id: string): Promise<void> {
  return apiFetch<void>(`/net-worth/entries/${id}`, { method: "DELETE" });
}

export function getNetWorthSummary(): Promise<NetWorthMonthSummary[]> {
  return apiFetch<NetWorthMonthSummary[]>("/net-worth/summary");
}
