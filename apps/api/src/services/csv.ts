// Small CSV serialisation helper shared by the export route.

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// Characters that spreadsheet apps (Excel, Sheets, LibreOffice) treat as the
// start of a formula. Without neutralising them, a user-controlled string
// like `=HYPERLINK(...)` or `=cmd|'/c calc'!A1` stored as e.g. a transaction
// description would execute when the exported CSV is opened (CSV/formula
// injection). Prefixing with a single quote forces spreadsheet apps to treat
// the cell as plain text while leaving the value unchanged for CSV parsers.
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

function escapeCell(raw: string): string {
  const safe = FORMULA_PREFIX_RE.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
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
