/** One row of a spreadsheet as an import reads it (F3.9, adr/0018). */
export interface SheetRow {
  /** The file's row number (Excel's, or the CSV line), for error reports. */
  line: number
  cells: string[]
}

export interface SheetLimits {
  maxRows: number
  maxCells: number
}

/** The header (as written, trimmed) and the rows; or the message key of what is wrong with the file. */
export type SheetRead =
  { ok: true; header: string[]; rows: SheetRow[] } | { ok: false; key: string }
