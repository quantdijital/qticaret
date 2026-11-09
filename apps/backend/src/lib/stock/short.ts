/**
 * An order placed short of stock (adr/0026 Ek 2026-11-06): a paid cart
 * always becomes an order, so one whose units the shelf could not hold is
 * placed as a backorder and marked on its metadata. The shop makes or
 * buys the units, or cancels and refunds; shipping fills the missing
 * reservations itself (adr/0054 Ek 2026-11-05).
 */

/** The order's metadata key. */
export const STOCK_SHORT_KEY = "stock_short"

/** Emitted with `{ id }` (the order) once a paid cart became an order short of stock. */
export const ORDER_STOCK_SHORT = "order.stock_short"

export interface StockShortLine {
  variant_id: string
  /** The product and option as the order line names them. */
  title: string
  sku: string | null
  /** Units the order asks for. */
  quantity: number
  /** Units the shelf had none for when the order was placed. */
  short: number
}

export interface StockShort {
  lines: StockShortLine[]
  /** When it was found, ISO. */
  at: string
}

export interface CartStockLine {
  variant_id: string | null
  quantity: number
  title: string
  sku: string | null
  /** Tracked and not sold past the shelf: the only lines that can be short. */
  tracked: boolean
}

/**
 * The tracked variants of these lines with fewer units for sale than
 * asked for, a variant on several lines counted once. `available` is
 * Medusa's own (stocked − reserved over the channel's locations; a variant
 * missing from it has none).
 */
export function stockShortfall(
  lines: readonly CartStockLine[],
  available: Readonly<Record<string, number>>
): StockShortLine[] {
  const wanted = new Map<string, StockShortLine>()
  for (const line of lines) {
    if (!line.tracked || !line.variant_id) {
      continue
    }
    const known = wanted.get(line.variant_id)
    wanted.set(line.variant_id, {
      variant_id: line.variant_id,
      title: known?.title ?? line.title,
      sku: known?.sku ?? line.sku,
      quantity: (known?.quantity ?? 0) + line.quantity,
      short: 0,
    })
  }
  return [...wanted.values()].flatMap((line) => {
    const free = Math.max(0, Math.floor(available[line.variant_id] ?? 0))
    const short = line.quantity - free
    return short > 0 ? [{ ...line, short }] : []
  })
}

const isLine = (value: unknown): value is StockShortLine => {
  const line = value as Partial<StockShortLine> | null
  return (
    typeof line === "object" &&
    line !== null &&
    typeof line.variant_id === "string" &&
    typeof line.title === "string" &&
    (line.sku === null || typeof line.sku === "string") &&
    typeof line.quantity === "number" &&
    typeof line.short === "number" &&
    line.short > 0
  )
}

/** The order's mark, read defensively from its metadata; null when it has none. */
export function stockShortOf(
  metadata: Record<string, unknown> | null | undefined
): StockShort | null {
  const value = metadata?.[STOCK_SHORT_KEY] as { lines?: unknown; at?: unknown } | undefined
  if (!value || !Array.isArray(value.lines)) {
    return null
  }
  const lines = value.lines.filter(isLine)
  return lines.length > 0
    ? { lines, at: typeof value.at === "string" ? value.at : new Date(0).toISOString() }
    : null
}

/** "Chuby Kahverengi ×1, Kupa ×2": the short lines as the alerts name them. */
export const shortLinesText = (short: StockShort): string =>
  short.lines.map((line) => `${line.title} ×${String(line.short)}`).join(", ")

/** The units short in all. */
export const shortUnits = (short: StockShort | null): number =>
  short ? short.lines.reduce((sum, line) => sum + line.short, 0) : 0
