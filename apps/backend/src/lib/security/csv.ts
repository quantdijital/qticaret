/**
 * CSV for exports (docs/04): text that a spreadsheet would read as a formula
 * (`=`, `+`, `-`, `@`, tab, CR, or their fullwidth forms) gets an apostrophe,
 * and cells are quoted per RFC 4180. Numbers are written as numbers:
 * escaping a negative number would corrupt the data.
 *
 * Excel in a Turkish locale splits rows on `;`, where quotes from a comma
 * file mean nothing, so a formula can start mid-cell: after a `,`, `;` or
 * tab, spaces allowed. Those starts are escaped too, whatever the delimiter.
 * Exports for Turkish users write `;` and a BOM (`CSV_BOM`).
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

/** Text a spreadsheet would read as a formula, made plain text with an apostrophe. */
export const escapeFormulas = (text: string): string => text.replace(FORMULA_START, "$1$2'")

const ESCAPED_FORMULA = new RegExp(`(^|[,;\\t])([ \\u00a0]*)'(?=[${FORMULA_CHARS}])`, "g")

/** An exported cell read back: the apostrophes `escapeFormulas` added come off. */
export const unescapeFormulas = (text: string): string => text.replace(ESCAPED_FORMULA, "$1$2")

// A spreadsheet cell has no delimiters inside: only its start can read as a formula
const LEADING_FORMULA = new RegExp(`^([ \\u00a0]*)(?=[${FORMULA_CHARS}])`)
const LEADING_ESCAPED = new RegExp(`^([ \\u00a0]*)'(?=[${FORMULA_CHARS}])`)

/** A spreadsheet cell's escape: an apostrophe before a formula-like start only. */
export const escapeFormulaStart = (text: string): string => text.replace(LEADING_FORMULA, "$1'")

/** `escapeFormulaStart` undone, exactly. */
export const unescapeFormulaStart = (text: string): string => text.replace(LEADING_ESCAPED, "$1")

export interface CsvOptions {
  /**
   * Numbers with a decimal comma (`1,5`): Turkish Excel reads `1.5` as a
   * date. Still numbers: never escaped, a negative stays a negative.
   */
  decimalComma?: boolean
}

export function escapeCsvCell(value: unknown, options: CsvOptions = {}): string {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "number" && options.decimalComma) {
    return String(value).replace(".", ",")
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value)
  }
  const text = escapeFormulas(cellText(value))
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export type CsvDelimiter = "," | ";"

/**
 * Cells joined by `delimiter`. Turkish Excel opens `;` files as columns and
 * `,` files as one column; exports for Turkish users use `;` and a BOM.
 */
export function toCsvRow(
  values: readonly unknown[],
  delimiter: CsvDelimiter = ",",
  options: CsvOptions = {}
): string {
  const cell =
    options.decimalComma && delimiter === ","
      ? // A decimal comma in a comma file is quoted, or it splits the cell
        (value: unknown) =>
          typeof value === "number" ? `"${escapeCsvCell(value, options)}"` : escapeCsvCell(value)
      : (value: unknown) => escapeCsvCell(value, options)
  return values.map(cell).join(delimiter)
}

/** Rows joined with CRLF, ending with one (RFC 4180). */
export function toCsv(
  rows: readonly (readonly unknown[])[],
  delimiter: CsvDelimiter = ",",
  options: CsvOptions = {}
): string {
  return rows.map((row) => `${toCsvRow(row, delimiter, options)}\r\n`).join("")
}

/** A UTF-8 byte order mark: Excel reads Turkish letters right only with it. */
export const CSV_BOM = "\uFEFF"
