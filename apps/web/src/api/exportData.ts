import { apiFetchBlob } from "./client.js";

export type ExportFormat = "csv" | "zip" | "json";

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
