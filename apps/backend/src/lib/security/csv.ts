/**
 * CSV for exports (docs/04): text that a spreadsheet would read as a formula
 * (`=`, `+`, `-`, `@`, tab, CR, or their fullwidth forms) gets an apostrophe,
 * and cells are quoted per RFC 4180. Numbers are written as numbers:
 * escaping a negative number would corrupt the data.
 *
 * Excel in a Turkish locale splits rows on `;`, where quotes from a comma
 * file mean nothing, so a formula can start mid-cell: after a `,`, `;` or
 * tab, spaces allowed. Those starts are escaped too, whatever the delimiter.
 * The delimiter and BOM of an export are the export's choice (F2 S13).
 */

const FORMULA_CHARS = "=+\\-@\\t\\r\\uFF1D\\uFF0B\\uFF0D\\uFF20"
const FORMULA_START = new RegExp(`(^|[,;\\t])([ \\u00a0]*)(?=[${FORMULA_CHARS}])`, "g")
const NEEDS_QUOTES = /[",;\t\r\n]|^\s|\s$/

function cellText(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  // Other objects are written as JSON rather than "[object Object]"; one
  // that cannot be (a cycle) leaves the cell empty instead of failing the export
  try {
    // undefined for functions and symbols, despite the type
    const json: unknown = JSON.stringify(value)
    return typeof json === "string" ? json : ""
  } catch {
    return ""
  }
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value)
  }
  const text = cellText(value).replace(FORMULA_START, "$1$2'")
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsvRow(values: readonly unknown[]): string {
  return values.map(escapeCsvCell).join(",")
}

/** Rows joined with CRLF, ending with one (RFC 4180). */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => `${toCsvRow(row)}\r\n`).join("")
}
