/**
 * CSV the way Turkish Excel opens it (docs/04 like the server's exports):
 * `;` between cells, a BOM for UTF-8, quotes where needed, and cells that
 * would start a formula (= + - @, tab, CR) defused with a leading quote.
 */

const BOM = "﻿"
const FORMULA = /^[=+\-@\t\r]/

function cell(value: string | number): string {
  const text = typeof value === "number" ? String(value) : FORMULA.test(value) ? `'${value}` : value
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: (string | number)[][]): string {
  return BOM + rows.map((row) => row.map(cell).join(";")).join("\r\n")
}

/** Saves the rows as a file in the browser. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
