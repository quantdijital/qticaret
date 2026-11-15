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

/** A card's width at each screen, and whether (and where) it is the lead standing alone in its row. */
export interface CollageCard {
  phone: 6 | 12
  tablet: 6 | 12
  lg: CollageSpan
  xl: CollageSpan
  /** The lead card: under 1024 px it stands alone in its row, and its photo is taller. */
  lead: boolean
  /** The wide screens where the lead stands alone in its row too, its photo taller there. */
  alone: ("lg" | "xl")[]
}

/**
 * Every card's widths: one a row on a phone (two when the shop asks), two
 * on a tablet, at most three from 1024 px and the shop's `columns` from
 * 1280 px (a narrow card would crop a long, flat product to a sliver).
 */
export function collageCards(
  count: number,
  lead: boolean,
  columns: number,
  phoneColumns: 1 | 2
): CollageCard[] {
  const pairs = collageRows(count, lead, 2)
  const lg = collageRows(count, lead, Math.min(columns, 3))
  const xl = collageRows(count, lead, columns)
  const leading = lead && count > 1
  return pairs.map((pair, index) => {
    const tablet = pair.span === 12 ? 12 : 6
    const rows = { lg: lg[index] ?? pair, xl: xl[index] ?? pair }
    return {
      phone: phoneColumns === 2 ? tablet : 12,
      tablet,
      lg: rows.lg.span,
      xl: rows.xl.span,
      lead: leading && index === 0,
      alone:
        leading && index === 0 ? (["lg", "xl"] as const).filter((at) => rows[at].span === 12) : [],
    }
  })
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
