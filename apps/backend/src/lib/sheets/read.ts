import { readCsv, unescapeFormulaStart, unescapeFormulas } from "../security"
import type { SheetLimits, SheetRead } from "./types"
import { readXlsx } from "./xlsx-read"

export type SheetFormat = "xlsx" | "csv"

// An xlsx file is a zip; everything else must be text
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/** What the bytes are, whatever the file's name says; null for neither. */
export function sheetFormatOf(buffer: Buffer): SheetFormat | null {
  if (buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
    return "xlsx"
  }
  // A NUL byte is binary, not a CSV
  return buffer.length > 0 && !buffer.subarray(0, 8192).includes(0) ? "csv" : null
}

// Turkish Excel saves "CSV" in Windows-1254 unless asked for UTF-8
function csvText(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder("windows-1254").decode(buffer)
  }
}

// An exported cell read back: the apostrophe the export put before formula-like text comes off
function unescaped(read: SheetRead, unescape: (text: string) => string): SheetRead {
  return read.ok
    ? { ...read, rows: read.rows.map((row) => ({ ...row, cells: row.cells.map(unescape) })) }
    : read
}

/**
 * A spreadsheet the panel uploads, by its bytes: the first sheet of an
 * xlsx, or a CSV; the cells as they were before an export escaped them
 * (an xlsx cell's start, a CSV cell's starts after its delimiters too).
 */
export async function readSheet(buffer: Buffer, limits: SheetLimits): Promise<SheetRead> {
  const format = sheetFormatOf(buffer)
  if (format === "xlsx") {
    return unescaped(await readXlsx(buffer, limits), unescapeFormulaStart)
  }
  if (format === null) {
    return { ok: false, key: "upload.sheet_invalid" }
  }
  const read = readCsv(csvText(buffer), limits)
  // The CSV reader's keys speak of the redirect file's limits; a sheet has its own
  return read.ok
    ? unescaped({ ok: true, header: read.header, rows: read.rows }, unescapeFormulas)
    : { ok: false, key: read.key.replace("upload.csv_", "upload.sheet_") }
}
