/**
 * CSV the way Turkish Excel opens it, with the server's escaping rules
 * (apps/backend/src/lib/security/csv.ts, docs/04): `;` between cells, a
 * BOM for UTF-8, CRLF rows, RFC 4180 quotes. Text a spreadsheet would read
 * as a formula (`=`, `+`, `-`, `@`, tab, CR or their fullwidth forms) gets
 * an apostrophe, also after leading spaces and mid-cell after `,`, `;` or
 * tab. Numbers stay numbers. Keep the two copies in step.
 */

const BOM = "﻿"
const FORMULA_CHARS = "=+\\-@\\t\\r\\uFF1D\\uFF0B\\uFF0D\\uFF20"
const FORMULA_START = new RegExp(`(^|[,;\\t])([ \\u00a0]*)(?=[${FORMULA_CHARS}])`, "g")
const NEEDS_QUOTES = /[",;\t\r\n]|^\s|\s$/

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "number") {
    return String(value)
  }
  const text = value.replace(FORMULA_START, "$1$2'")
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: (string | number | null)[][]): string {
  return BOM + rows.map((row) => `${row.map(escapeCsvCell).join(";")}\r\n`).join("")
}

/** Saves the rows as a file in the browser. */
export function downloadCsv(filename: string, rows: (string | number | null)[][]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
