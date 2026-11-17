import {
  FOOTER_BLOCK_MAX,
  FOOTER_ROWS_LIMITS as L,
  FOOTER_ROW_DEFAULTS,
  footerRowColumns,
} from "@qticaret/types"
import type { FooterBlockType, FooterRowLayout } from "@qticaret/types"
import type { FooterBlock, FooterRow } from "@/features/storefront/api/layout"

/**
 * The free rows footer's changes (adr/0070 §7), each a pure function of
 * the rows: the editor sends the footer back whole in one `update`, so
 * each change is one step "Geri al" takes back. A change the limits
 * forbid returns the rows as they were (the same array), and the tree's
 * buttons ask first (`blockRoom`, `rowRoom`) so they stand disabled.
 */

export type Rows = readonly FooterRow[]

/** Where a block stands: its row, column and place in the column. */
export interface BlockPlace {
  row: number
  column: number
  index: number
}

/** A place to move a block to: the row by its id, the column and the place in it. */
export interface BlockTarget {
  row: string
  column: number
  index: number
}

export const allBlocks = (rows: Rows): FooterBlock[] =>
  rows.flatMap((row) => row.columns.flatMap((column) => column.blocks))

export const typeCount = (rows: Rows, type: FooterBlockType): number =>
  allBlocks(rows).filter((block) => block.type === type).length

/** A block by its id, with where it stands; null: not in these rows. */
export function findBlock(rows: Rows, id: string): (BlockPlace & { block: FooterBlock }) | null {
  for (const [row, each] of rows.entries()) {
    for (const [column, { blocks }] of each.columns.entries()) {
      const index = blocks.findIndex((block) => block.id === id)
      const block = blocks[index]
      if (block) {
        return { row, column, index, block }
      }
    }
  }
  return null
}

/**
 * Each block's place in the design (`at`, adr/0070 §2.2): counted row by
 * row, column by column, hidden ones too, as the store prints it; the
 * preview names a block by it (`blocks.<at>`).
 */
export const blockAt = (rows: Rows, at: number): FooterBlock | null => allBlocks(rows)[at] ?? null

export const atOf = (rows: Rows, id: string): number =>
  allBlocks(rows).findIndex((block) => block.id === id)

/** Why another block of `type` cannot be added (to `column` of row `row`); null: it can. */
export function blockRoom(
  rows: Rows,
  type: FooterBlockType,
  where?: { row: number; column: number }
): "type" | "footer" | "column" | null {
  if (typeCount(rows, type) >= FOOTER_BLOCK_MAX[type]) {
    return "type"
  }
  if (allBlocks(rows).length >= L.blocks) {
    return "footer"
  }
  const column = where ? rows[where.row]?.columns[where.column] : undefined
  return column && column.blocks.length >= L.perColumn ? "column" : null
}

/** Whether another row may be added (or this one copied, its blocks within the limits). */
export function rowRoom(rows: Rows, copied?: FooterRow): boolean {
  if (rows.length >= L.rows) {
    return false
  }
  if (!copied) {
    return true
  }
  const blocks = copied.columns.flatMap((column) => column.blocks)
  const inRow = (type: FooterBlockType) => blocks.filter((block) => block.type === type).length
  return (
    allBlocks(rows).length + blocks.length <= L.blocks &&
    blocks.every(
      (block) => typeCount(rows, block.type) + inRow(block.type) <= FOOTER_BLOCK_MAX[block.type]
    )
  )
}

/** A new row of a split, its columns empty, every setting at its default. */
export function newRow(
  id: string,
  layout: FooterRowLayout = FOOTER_ROW_DEFAULTS.layout
): FooterRow {
  return {
    id,
    ...FOOTER_ROW_DEFAULTS,
    layout,
    columns: Array.from({ length: footerRowColumns(layout) }, () => ({ blocks: [] })),
  }
}

const withRow = (rows: Rows, index: number, row: FooterRow): FooterRow[] =>
  rows.map((each, at) => (at === index ? row : each))

export function addRow(rows: Rows, row: FooterRow, at = rows.length): Rows {
  if (!rowRoom(rows)) {
    return rows
  }
  const next = [...rows]
  next.splice(Math.max(0, Math.min(at, rows.length)), 0, row)
  return next
}

/** A row taken off; the footer keeps at least one. */
export function removeRow(rows: Rows, id: string): Rows {
  return rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)
}

/** A copy right after the row, it and its blocks under new ids. */
export function duplicateRow(rows: Rows, id: string, newId: () => string): Rows {
  const index = rows.findIndex((row) => row.id === id)
  const row = rows[index]
  if (!row || !rowRoom(rows, row)) {
    return rows
  }
  const copy: FooterRow = {
    ...structuredClone(row),
    id: newId(),
    columns: row.columns.map((column) => ({
      blocks: column.blocks.map((block) => ({ ...structuredClone(block), id: newId() })),
    })),
  }
  return addRow(rows, copy, index + 1)
}

/** A row to a new place (held within the list). */
export function moveRow(rows: Rows, id: string, to: number): Rows {
  const from = rows.findIndex((row) => row.id === id)
  const target = Math.max(0, Math.min(to, rows.length - 1))
  if (from < 0 || from === target) {
    return rows
  }
  const next = [...rows]
  const [row] = next.splice(from, 1) as [FooterRow]
  next.splice(target, 0, row)
  return next
}

/**
 * A row's split changed: more columns come empty; fewer, and the blocks
 * of the columns let go join the last one kept, none lost (`merged`: some
 * did, the panel says so).
 */
export function setLayout(
  rows: Rows,
  id: string,
  layout: FooterRowLayout
): { rows: Rows; merged: boolean } {
  const index = rows.findIndex((row) => row.id === id)
  const row = rows[index]
  if (!row || row.layout === layout) {
    return { rows, merged: false }
  }
  const count = footerRowColumns(layout)
  const kept = row.columns.slice(0, count).map((column) => ({ blocks: [...column.blocks] }))
  while (kept.length < count) {
    kept.push({ blocks: [] })
  }
  const dropped = row.columns.slice(count).flatMap((column) => column.blocks)
  kept[count - 1]?.blocks.push(...dropped)
  return {
    rows: withRow(rows, index, { ...row, layout, columns: kept }),
    merged: dropped.length > 0,
  }
}

export function updateRow(rows: Rows, row: FooterRow): Rows {
  const index = rows.findIndex((each) => each.id === row.id)
  return index < 0 ? rows : withRow(rows, index, row)
}

/** The rows with one block's column replaced by `change`'s answer. */
function inColumn(
  rows: Rows,
  row: number,
  column: number,
  change: (blocks: FooterBlock[]) => FooterBlock[]
): Rows {
  const each = rows[row]
  if (!each?.columns[column]) {
    return rows
  }
  const columns = each.columns.map((one, at) =>
    at === column ? { blocks: change([...one.blocks]) } : one
  )
  return withRow(rows, row, { ...each, columns })
}

/** A block added at the end of a column (or at `index`), within every limit. */
export function addBlock(
  rows: Rows,
  target: { row: string; column: number; index?: number },
  block: FooterBlock
): Rows {
  const row = rows.findIndex((each) => each.id === target.row)
  if (row < 0 || blockRoom(rows, block.type, { row, column: target.column }) !== null) {
    return rows
  }
  return inColumn(rows, row, target.column, (blocks) => {
    blocks.splice(target.index ?? blocks.length, 0, block)
    return blocks
  })
}

export function updateBlock(rows: Rows, block: FooterBlock): Rows {
  const found = findBlock(rows, block.id)
  return found
    ? inColumn(rows, found.row, found.column, (blocks) =>
        blocks.map((each) => (each.id === block.id ? block : each))
      )
    : rows
}

export function removeBlock(rows: Rows, id: string): Rows {
  const found = findBlock(rows, id)
  return found
    ? inColumn(rows, found.row, found.column, (blocks) => blocks.filter((each) => each.id !== id))
    : rows
}

/** A copy right under the block, under a new id. */
export function duplicateBlock(rows: Rows, id: string, newId: () => string): Rows {
  const found = findBlock(rows, id)
  if (!found) {
    return rows
  }
  const row = rows[found.row]
  return row
    ? addBlock(
        rows,
        { row: row.id, column: found.column, index: found.index + 1 },
        { ...structuredClone(found.block), id: newId() }
      )
    : rows
}

/**
 * A block to another place: its row (by id), column and place there,
 * counted once it has left its own (dropped "before" a block below it in
 * the same column lands one higher). A full column takes no more.
 */
export function moveBlock(rows: Rows, id: string, target: BlockTarget): Rows {
  const found = findBlock(rows, id)
  const row = rows.findIndex((each) => each.id === target.row)
  const column = rows[row]?.columns[target.column]
  if (!found || !column) {
    return rows
  }
  const same = found.row === row && found.column === target.column
  if (!same && column.blocks.length >= L.perColumn) {
    return rows
  }
  const without = removeBlock(rows, id)
  const room = without[row]?.columns[target.column]?.blocks.length ?? 0
  const index = Math.max(0, Math.min(target.index, room))
  if (same && index === found.index) {
    return rows
  }
  return inColumn(without, row, target.column, (blocks) => {
    blocks.splice(index, 0, found.block)
    return blocks
  })
}

/**
 * Where the arrow buttons take a block (WCAG 2.5.7): one place up or down
 * in its column, past its edge to the end of the column before it (or the
 * start of the one after), row after row. Null: nowhere to go.
 */
export function stepTarget(rows: Rows, id: string, step: -1 | 1): BlockTarget | null {
  const found = findBlock(rows, id)
  if (!found) {
    return null
  }
  const column = rows[found.row]?.columns[found.column]
  const next = found.index + step
  if (column && next >= 0 && next < column.blocks.length) {
    return { row: rows[found.row]?.id ?? "", column: found.column, index: next }
  }
  // The columns in reading order: the one before or after this one with room
  const order = rows.flatMap((row, r) => row.columns.map((each, c) => ({ r, c, each })))
  const here = order.findIndex((slot) => slot.r === found.row && slot.c === found.column)
  for (let at = here + step; at >= 0 && at < order.length; at += step) {
    const slot = order[at]
    if (slot && slot.each.blocks.length < L.perColumn) {
      return {
        row: rows[slot.r]?.id ?? "",
        column: slot.c,
        index: step < 0 ? slot.each.blocks.length : 0,
      }
    }
  }
  return null
}
