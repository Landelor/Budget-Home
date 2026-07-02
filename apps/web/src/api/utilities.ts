import { apiFetch, uploadFile, apiFetchBlob } from "./client.js";

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
  const formData = new FormData();
  formData.append("file", file);
  return uploadFile<UtilityAttachment>(`/utilities/${utilityId}/attachments`, formData);
}

export function deleteUtilityAttachment(attachmentId: string): Promise<void> {
  return apiFetch<void>(`/utilities/attachments/${attachmentId}`, { method: "DELETE" });
}

export async function fetchUtilityAttachmentBlob(attachmentId: string): Promise<string> {
  const blob = await apiFetchBlob(`/utilities/attachments/${attachmentId}/content`);
  return URL.createObjectURL(blob);
}
