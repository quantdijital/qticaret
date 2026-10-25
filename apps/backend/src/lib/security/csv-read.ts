import { CSV_BOM } from "./csv"
import type { CsvDelimiter } from "./csv"

/**
 * Reads a CSV file the panel uploads (RFC 4180): quoted cells may hold the
 * delimiter, quotes and line breaks. The delimiter is the header line's:
 * Turkish Excel saves with `;`, the rest of the world with `,`. Limits keep
 * a hostile file from costing more than its size.
 */

export interface CsvRow {
  /** The file's line where the row starts, for error reports. */
  line: number
  cells: string[]
}

export interface CsvReadLimits {
  maxRows: number
  maxCells: number
}

export type CsvRead = { ok: true; header: string[]; rows: CsvRow[] } | { ok: false; key: string }

function detectDelimiter(text: string): CsvDelimiter {
  const end = text.search(/\r?\n/)
  const header = end === -1 ? text : text.slice(0, end)
  return (header.match(/;/g) ?? []).length > (header.match(/,/g) ?? []).length ? ";" : ","
}

// Rows, or the message key of what is wrong with the file
function tokenize(text: string, delimiter: CsvDelimiter, limits: CsvReadLimits): CsvRow[] | string {
  const rows: CsvRow[] = []
  let cells: string[] = []
  let cell = ""
  let quoted = false
  let line = 1
  let rowLine = 1
  const endRow = (): boolean => {
    cells.push(cell)
    if (cells.length > 1 || cells[0] !== "") {
      rows.push({ line: rowLine, cells })
    }
    cells = []
    cell = ""
    rowLine = line
    return rows.length <= limits.maxRows
  }
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index)
    if (quoted) {
      if (char === '"' && text.charAt(index + 1) === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        line += char === "\n" ? 1 : 0
        cell += char
      }
    } else if (char === '"' && cell === "") {
      quoted = true
    } else if (char === delimiter) {
      cells.push(cell)
      cell = ""
      if (cells.length > limits.maxCells) {
        return "upload.csv_too_wide"
      }
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(index + 1) === "\n") {
        index += 1
      }
      line += 1
      if (!endRow()) {
        return "upload.csv_too_many_rows"
      }
    } else {
      cell += char
    }
  }
  if (quoted) {
    return "upload.csv_invalid"
  }
  if ((cell !== "" || cells.length > 0) && !endRow()) {
    return "upload.csv_too_many_rows"
  }
  return rows
}

/** The header (lower case, trimmed) and the rows; a broken or oversized file is refused. */
export function readCsv(raw: string, limits: CsvReadLimits): CsvRead {
  const text = raw.startsWith(CSV_BOM) ? raw.slice(1) : raw
  const rows = tokenize(text, detectDelimiter(text), { ...limits, maxRows: limits.maxRows + 1 })
  if (typeof rows === "string") {
    return { ok: false, key: rows }
  }
  const [head, ...body] = rows
  if (!head) {
    return { ok: false, key: "upload.csv_empty" }
  }
  return {
    ok: true,
    header: head.cells.map((cell) => cell.trim().toLowerCase()),
    rows: body,
  }
}
