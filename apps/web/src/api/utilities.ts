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

export interface UtilityAttachment {
  id: string;
  userId: string;
  utilityId: string;
  originalName: string;
  storageKey: string;
  fileSize: number;
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

export function listAllUtilityAttachments(): Promise<UtilityAttachment[]> {
  return apiFetch<UtilityAttachment[]>("/utilities/attachments");
}

export function uploadUtilityAttachment(utilityId: string, file: File): Promise<UtilityAttachment> {
  const token = localStorage.getItem("accessToken");
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`/api/utilities/${utilityId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? "Upload failed");
    }
    return res.json() as Promise<UtilityAttachment>;
  });
}

export function deleteUtilityAttachment(attachmentId: string): Promise<void> {
  return apiFetch<void>(`/utilities/attachments/${attachmentId}`, { method: "DELETE" });
}

export async function fetchUtilityAttachmentBlob(attachmentId: string): Promise<string> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`/api/utilities/attachments/${attachmentId}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch attachment");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
