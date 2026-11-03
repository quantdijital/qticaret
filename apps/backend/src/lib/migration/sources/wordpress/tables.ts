import type { Inline, Paragraph, Table, TableRow } from "../../../content/doc"

/**
 * A body's table as its tags come (`blocks.ts`): rows of header and data
 * cells, each cell one paragraph of running text, within the document's
 * bounds (500 rows, 30 cells a row). A table of empty cells is none.
 */

const MAX_ROWS = 500
const MAX_CELLS = 30

/** Leading and trailing spaces and breaks off; empty nodes gone. */
export function tidy(inlines: readonly Inline[]): Inline[] {
  const out = [...inlines]
  while (out[0]?.type === "hardBreak") {
    out.shift()
  }
  while (out.at(-1)?.type === "hardBreak") {
    out.pop()
  }
  const first = out[0]
  if (first?.type === "text") {
    out[0] = { ...first, text: first.text.replace(/^\s+/, "") }
  }
  const last = out.at(-1)
  if (last?.type === "text") {
    out[out.length - 1] = { ...last, text: last.text.replace(/\s+$/, "") }
  }
  return out.filter((node) => node.type !== "text" || node.text !== "")
}

export class TableDraft {
  private readonly rows: TableRow[] = []
  private row: TableRow["content"] | null = null
  private cell: { header: boolean; inlines: Inline[] } | null = null

  /** The open cell's running text; none between cells. */
  get inlines(): Inline[] | null {
    return this.cell?.inlines ?? null
  }

  private closeCell(): void {
    if (!this.cell || !this.row) {
      return
    }
    const content = tidy(this.cell.inlines)
    const paragraph: Paragraph =
      content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" }
    this.row.push({ type: this.cell.header ? "tableHeader" : "tableCell", content: [paragraph] })
    this.cell = null
  }

  /** A row's start or end (`open` false ends the last one). */
  rowAt(open: boolean): void {
    this.closeCell()
    if (this.row && this.row.length > 0 && this.rows.length < MAX_ROWS) {
      this.rows.push({ type: "tableRow", content: this.row.slice(0, MAX_CELLS) })
    }
    this.row = open ? [] : null
  }

  cellAt(open: boolean, header: boolean): void {
    this.closeCell()
    if (open) {
      this.row ??= []
      this.cell = { header, inlines: [] }
    }
  }

  /** The table, or none for one without a filled cell. */
  finish(): Table | null {
    this.rowAt(false)
    const filled = this.rows.some((row) =>
      row.content.some((cell) => (cell.content[0]?.content ?? []).length > 0)
    )
    return filled ? { type: "table", content: this.rows } : null
  }
}
