/**
 * The most of a product one order may hold (S5; WooCommerce's "sold
 * individually" is a limit of 1): the product's own `max_quantity`
 * (catalog extension), all its variants together. Checked as lines are
 * added or changed and once more as the cart completes; the client's
 * word is never taken for it.
 */

/** The highest limit a shop may set; above it a limit means nothing. */
export const MAX_PURCHASE_QUANTITY = 9999

/** A product's limit as stored: a whole number from 1; anything else is none. */
export function purchaseLimitOf(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_PURCHASE_QUANTITY
    ? value
    : null
}

export interface LimitLine {
  /** The line's id; absent for a line being added. */
  id?: string | undefined
  variant_id: string
  quantity: number
}

export interface VariantLimit {
  product_id: string
  title: string
  limit: number | null
}

export interface LimitExceeded {
  product_id: string
  title: string
  limit: number
  quantity: number
}

/** The first product whose lines together hold more than its limit, or null. */
export function firstOverLimit(
  lines: readonly LimitLine[],
  variants: ReadonlyMap<string, VariantLimit>
): LimitExceeded | null {
  const totals = new Map<string, { quantity: number; product: VariantLimit }>()
  for (const line of lines) {
    const product = variants.get(line.variant_id)
    if (product?.limit === null || product === undefined) {
      continue
    }
    const total = totals.get(product.product_id)
    totals.set(product.product_id, {
      // Medusa refuses a count that is not a number; the completion check reads the stored lines
      quantity:
        (total?.quantity ?? 0) + (Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0),
      product,
    })
  }
  for (const [productId, { quantity, product }] of totals) {
    if (product.limit !== null && quantity > product.limit) {
      return { product_id: productId, title: product.title, limit: product.limit, quantity }
    }
  }
  return null
}

/** The cart's lines with new ones added (a variant already in it merges into its line's count). */
export const withAdded = (
  lines: readonly LimitLine[],
  added: readonly LimitLine[]
): LimitLine[] => [...lines, ...added]

/**
 * The cart's lines with one line's count changed. A change that lowers the
 * count is never refused (a limit set after the line was added): only a
 * rise is judged, so `null` says there is nothing to check.
 */
export function withChanged(
  lines: readonly LimitLine[],
  itemId: string,
  quantity: number
): LimitLine[] | null {
  const line = lines.find((each) => each.id === itemId)
  if (!line || quantity <= line.quantity) {
    return null
  }
  return lines.map((each) => (each.id === itemId ? { ...each, quantity } : each))
}
