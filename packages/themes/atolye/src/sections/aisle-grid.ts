/**
 * How many equal tiles stand in a row from 1024 px and from 1280 px for
 * the shop's number of categories: full rows first, then the fewest empty
 * places, never one tile alone on its last row; between equals the count
 * nearest the width's own. Classes are written out whole for Tailwind.
 */

const LG_CHOICES = [3, 4, 5, 6] as const
const XL_CHOICES = [4, 5, 6, 7] as const

const LG_CLASS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
}

const XL_CLASS: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
  7: "xl:grid-cols-7",
}

/** The columns for `count` tiles among `choices`, nearest `target` when several fit as well. */
export function columnsFor(count: number, choices: readonly number[], target: number): number {
  const smallest = choices[0] ?? 1
  if (count <= smallest) {
    return Math.max(count, 1)
  }
  let best: { columns: number; empty: number; off: number } | null = null
  for (const columns of choices) {
    const rest = count % columns
    if (columns > count || rest === 1) {
      continue
    }
    const empty = rest === 0 ? 0 : columns - rest
    const off = Math.abs(columns - target)
    if (!best || empty < best.empty || (empty === best.empty && off < best.off)) {
      best = { columns, empty, off }
    }
  }
  return best?.columns ?? Math.min(count, choices.at(-1) ?? 1)
}

/** The grid's column classes for this many tiles at 1024 px and at 1280 px. */
export function aisleColumns(count: number): string {
  const lg = columnsFor(count, LG_CHOICES, 4)
  const xl = columnsFor(count, XL_CHOICES, 6)
  return `${LG_CLASS[lg] ?? ""} ${XL_CLASS[xl] ?? ""}`
}
