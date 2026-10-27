import type { MedusaAmount } from "../../lib/money"
import type { ItemFacts, ShippingFacts } from "../../lib/orders"

/**
 * A cart's lines as Query returns them, made into the facts `lib/orders`
 * works on (F4.7): raw decimals, as an order's are read, so a cart's
 * shares come out as its order's will.
 */

export const CART_LINE_FIELDS = [
  "items.id",
  "items.quantity",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.requires_shipping",
  "items.raw_unit_price",
  "items.is_tax_inclusive",
  "items.tax_lines.rate",
  "items.adjustments.raw_amount",
  "items.adjustments.is_tax_inclusive",
  "shipping_methods.id",
  "shipping_methods.name",
  "shipping_methods.raw_amount",
  "shipping_methods.is_tax_inclusive",
  "shipping_methods.tax_lines.rate",
  "shipping_methods.adjustments.raw_amount",
]

type Amount = MedusaAmount | null | undefined
type Rows<T> = (T | null)[] | null | undefined

export interface CartItemRow {
  id: string
  quantity: number
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  requires_shipping?: boolean | null
  raw_unit_price?: Amount
  is_tax_inclusive?: boolean | null
  tax_lines?: Rows<{ rate?: number | null }>
  adjustments?: Rows<{ raw_amount?: Amount; is_tax_inclusive?: boolean | null }>
}

export interface CartShippingRow {
  id: string
  name?: string | null
  raw_amount?: Amount
  is_tax_inclusive?: boolean | null
  tax_lines?: Rows<{ rate?: number | null }>
  adjustments?: Rows<{ raw_amount?: Amount }>
}

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

function required(amount: Amount, what: string): MedusaAmount {
  if (amount === null || amount === undefined) {
    throw new RangeError(`${what} has no amount`)
  }
  return amount
}

export const itemFacts = (item: CartItemRow): ItemFacts => ({
  id: item.id,
  quantity: item.quantity,
  unit_price: required(item.raw_unit_price, `item ${item.id}`),
  is_tax_inclusive: item.is_tax_inclusive ?? null,
  tax_lines: present(item.tax_lines),
  adjustments: present(item.adjustments).map((row) => ({
    amount: required(row.raw_amount, "an adjustment"),
    is_tax_inclusive: row.is_tax_inclusive ?? null,
  })),
})

export const shippingFacts = (method: CartShippingRow): ShippingFacts => ({
  id: method.id,
  amount: required(method.raw_amount, `shipping method ${method.id}`),
  is_tax_inclusive: method.is_tax_inclusive ?? null,
  tax_lines: present(method.tax_lines),
  adjustments: present(method.adjustments).map((row) => ({
    amount: required(row.raw_amount, "an adjustment"),
  })),
})

/** The first name given that is not blank. */
const firstName = (...names: (string | null | undefined)[]): string | undefined =>
  names.map((name) => name?.trim()).find((name) => name)

/** What the shopper sees a line as: the product and its variant. */
export function itemName(item: CartItemRow): string {
  const product = firstName(item.product_title, item.title) ?? "Ürün"
  const variant = firstName(item.variant_title)
  return variant && variant !== product ? `${product} - ${variant}` : product
}

export const shippingName = (method: CartShippingRow): string => firstName(method.name) ?? "Kargo"

export { present }
