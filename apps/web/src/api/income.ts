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
  date: string;
  amount: string;
  currency: string;
  frequency: IncomeFrequency;
  createdAt: string;
}

export interface IncomeAttachment {
  id: string;
  userId: string;
  incomeId: string;
  originalName: string;
  storageKey: string;
  fileSize: number;
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
  date: string;
  amount: number;
  currency: string;
  personId?: string;
}): Promise<Income> {
  return apiFetch<Income>("/income", { method: "POST", body: JSON.stringify(body) });
}

export function updateIncome(
  id: string,
  body: { name?: string; date?: string; amount?: number; currency?: string; personId?: string | null },
): Promise<Income> {
  return apiFetch<Income>(`/income/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteIncome(id: string): Promise<void> {
  return apiFetch<void>(`/income/${id}`, { method: "DELETE" });
}

export function listAllIncomeAttachments(): Promise<IncomeAttachment[]> {
  return apiFetch<IncomeAttachment[]>("/income/attachments");
}

export function listIncomeAttachments(incomeId: string): Promise<IncomeAttachment[]> {
  return apiFetch<IncomeAttachment[]>(`/income/${incomeId}/attachments`);
}

export function uploadIncomeAttachment(incomeId: string, file: File): Promise<IncomeAttachment> {
  const token = localStorage.getItem("accessToken");
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`/api/income/${incomeId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? "Upload failed");
    }
    return res.json() as Promise<IncomeAttachment>;
  });
}

export function deleteIncomeAttachment(attachmentId: string): Promise<void> {
  return apiFetch<void>(`/income/attachments/${attachmentId}`, { method: "DELETE" });
}

export async function fetchIncomeAttachmentBlob(attachmentId: string): Promise<string> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`/api/income/attachments/${attachmentId}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch attachment");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
