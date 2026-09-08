// Small CSV serialisation helper shared by the export route.

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeCell(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Convert an array of plain objects into a CSV string.
 * `columns` fixes both the column order and which fields are included,
 * so internal-only fields (userId, deletedAt, etc.) can be omitted.
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: (keyof T & string)[],
): string {
  const header = columns.map(escapeCell).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCell(formatCell(row[col]))).join(","),
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}
