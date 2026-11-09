/** A line a paid order was placed without enough stock for (adr/0026 Ek 2026-11-06). */
export interface StockShortLine {
  title: string
  quantity: number
  short: number
}

const isLine = (value: unknown): value is StockShortLine => {
  const line = value as Partial<StockShortLine> | null
  return (
    typeof line === "object" &&
    line !== null &&
    typeof line.title === "string" &&
    typeof line.quantity === "number" &&
    typeof line.short === "number" &&
    line.short > 0
  )
}

/** The lines the server marked short on the order (`metadata.stock_short`); none when unmarked. */
export function stockShortLines(metadata: Record<string, unknown> | null | undefined) {
  const mark = metadata?.["stock_short"] as { lines?: unknown } | undefined
  return Array.isArray(mark?.lines) ? mark.lines.filter(isLine) : []
}
