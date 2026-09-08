import { apiFetchBlob, apiFetch } from "./client.js";

export type ExportFormat = "csv" | "zip" | "json";

export interface ImportSectionSummary {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface ImportResult {
  totalImported: number;
  totalSkipped: number;
  sections: Record<string, ImportSectionSummary>;
}

/**
 * Send a previously-exported JSON payload to the API to be merged into the
 * current user's data. Every row is inserted as a brand-new record — nothing
 * existing is overwritten or deleted.
 */
export function importData(payload: unknown): Promise<ImportResult> {
  return apiFetch<ImportResult>("/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


/**
 * Download the current user's data export and trigger a browser save.
 * `format` "csv" requests a ZIP of per-entity CSV files from the API.
 */
export async function downloadExport(format: ExportFormat): Promise<void> {
  const apiFormat = format === "csv" || format === "zip" ? "csv" : "json";
  const blob = await apiFetchBlob(`/export?format=${apiFormat}`);
  const extension = apiFormat === "csv" ? "zip" : "json";
  const timestamp = new Date().toISOString().slice(0, 10);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `budget-home-export-${timestamp}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
