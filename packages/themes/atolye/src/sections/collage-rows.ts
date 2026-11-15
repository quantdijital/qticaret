/**
 * The category collage's rows (adr/0049 Ek 2026-11-15): every card one
 * unit, the lead two; at most `perRow` units in a row, the units shared
 * out as evenly as the rows allow (the extra ones in the first rows), so
 * no row is left with one stray card while another is full. Each card's
 * width is its share of a twelve-column row: 3, 4, 6, 8 or 12.
 */
export type CollageSpan = 3 | 4 | 6 | 8 | 12

export interface CollagePlace {
  /** Twelfths of the row. */
  span: CollageSpan
  /** The card's row, from 0. */
  row: number
}

/** The cards' places for `count` cards, the first two units wide while `lead` (and more than one). */
export function collageRows(count: number, lead: boolean, perRow: number): CollagePlace[] {
  if (count <= 0) {
    return []
  }
  const sizes = Array.from({ length: count }, (_, index) =>
    index === 0 && lead && count > 1 ? 2 : 1
  )
  const units = sizes.reduce((sum, size) => sum + size, 0)
  const rows = Math.ceil(units / Math.max(perRow, 2))
  const base = Math.floor(units / rows)
  const extra = units % rows
  const targets = Array.from({ length: rows }, (_, row) => base + (row < extra ? 1 : 0))
  const rowOf: number[] = []
  const filled: number[] = []
  let row = 0
  for (const size of sizes) {
    if ((filled[row] ?? 0) > 0 && (filled[row] ?? 0) + size > (targets[row] ?? base)) {
      row += 1
    }
    filled[row] = (filled[row] ?? 0) + size
    rowOf.push(row)
  }
  return sizes.map((size, index) => {
    const at = rowOf[index] ?? 0
    return { span: ((12 * size) / (filled[at] ?? size)) as CollageSpan, row: at }
  })
}
