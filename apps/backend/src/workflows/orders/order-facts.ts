import type { MedusaAmount } from "../../lib/money"
import type { ItemFacts, ShippingFacts } from "../../lib/orders"

/**
 * What an order's money is read from (F4.7), as Medusa's Query returns
 * it, made into the facts `lib/orders` works on. Amounts are Medusa's raw
 * decimals: the JS numbers it also returns lose digits a discount split
 * three ways keeps (adr/0010).
 */
export const ORDER_MONEY_FIELDS = [
  "id",
  "version",
  "currency_code",
  "items.id",
  "items.quantity",
  "items.raw_unit_price",
  "items.is_tax_inclusive",
  "items.tax_lines.rate",
  "items.adjustments.raw_amount",
  "items.adjustments.is_tax_inclusive",
  "items.adjustments.version",
  // Medusa fills an item's quantity only with its detail requested, and puts
  // a price an order edit corrected (adr/0033) on the item only with it too
  "items.detail.quantity",
  "items.detail.unit_price",
  "items.detail.return_received_quantity",
  "items.detail.return_dismissed_quantity",
  "shipping_methods.id",
  "shipping_methods.raw_amount",
  "shipping_methods.is_tax_inclusive",
  "shipping_methods.tax_lines.rate",
  "shipping_methods.adjustments.raw_amount",
  "shipping_methods.adjustments.version",
  // Query leaves a shipping method's own return or claim out; theirs name it
  "returns.shipping_methods.shipping_method_id",
  "exchanges.shipping_methods.shipping_method_id",
  "claims.shipping_methods.shipping_method_id",
  // Gift cards and store credit (F4.8): Medusa takes them off the total the customer pays
  "credit_lines.raw_amount",
  "credit_lines.version",
  "payment_collections.raw_captured_amount",
  "payment_collections.raw_refunded_amount",
]

type Amount = MedusaAmount | null | undefined
type Rows<T> = (T | null)[] | null | undefined

interface AdjustmentRow {
  raw_amount?: Amount
  is_tax_inclusive?: boolean | null
  version?: number | null
}

interface LineRow {
  id: string
  is_tax_inclusive?: boolean | null
  tax_lines?: Rows<{ rate?: number | null }>
  adjustments?: Rows<AdjustmentRow>
}

/** A return, exchange or claim, by the shipping methods that came with it. */
interface Changes {
  shipping_methods?: Rows<{ shipping_method_id?: string | null }>
}

export interface OrderRow {
  id: string
  version: number
  currency_code: string
  items?: Rows<
    LineRow & {
      quantity: number
      raw_unit_price?: Amount
      detail?: {
        return_received_quantity?: number | null
        return_dismissed_quantity?: number | null
      } | null
    }
  >
  shipping_methods?: Rows<LineRow & { raw_amount?: Amount }>
  returns?: Rows<Changes>
  exchanges?: Rows<Changes>
  claims?: Rows<Changes>
  credit_lines?: Rows<{ raw_amount?: Amount; version?: number | null }>
  payment_collections?: Rows<{ raw_captured_amount?: Amount; raw_refunded_amount?: Amount }>
}

export interface OrderFacts {
  currency_code: string
  /** With the units that came back on returns (received or dismissed). */
  items: (ItemFacts & { returned: number })[]
  shipping: ShippingFacts[]
  /** Paid with gift cards and store credit, outside the payments. */
  credits: MedusaAmount[]
  payments: { captured: MedusaAmount; refunded: MedusaAmount }[]
}

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

function required(amount: Amount, what: string): MedusaAmount {
  if (amount === null || amount === undefined) {
    throw new RangeError(`${what} has no amount`)
  }
  return amount
}

/**
 * Medusa copies a line's adjustments, and the order's credit lines, into
 * each new version of the order (a fulfillment, a return), and Query
 * returns every copy; Medusa's own order reads keep the current version's.
 * So does this.
 */
const currentAdjustments = (rows: Rows<AdjustmentRow>, version: number) =>
  present(rows)
    .filter((row) => row.version === version)
    .map((row) => ({
      amount: required(row.raw_amount, "an adjustment"),
      is_tax_inclusive: row.is_tax_inclusive ?? null,
    }))

/**
 * The order as it was placed and paid. Shipping that came with a return,
 * an exchange or a claim is the shop's later cost, not something the
 * customer paid at checkout, so it is left out (Medusa counts it in the
 * order's shipping total).
 */
export function orderFacts(order: OrderRow): OrderFacts {
  const later = new Set(
    [order.returns, order.exchanges, order.claims].flatMap((changes) =>
      present(changes).flatMap((change) =>
        present(change.shipping_methods).flatMap((row) =>
          row.shipping_method_id ? [row.shipping_method_id] : []
        )
      )
    )
  )
  return {
    currency_code: order.currency_code,
    items: present(order.items).map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: required(item.raw_unit_price, `item ${item.id}`),
      is_tax_inclusive: item.is_tax_inclusive ?? null,
      tax_lines: item.tax_lines ?? null,
      adjustments: currentAdjustments(item.adjustments, order.version),
      returned:
        (item.detail?.return_received_quantity ?? 0) +
        (item.detail?.return_dismissed_quantity ?? 0),
    })),
    shipping: present(order.shipping_methods)
      .filter((method) => !later.has(method.id))
      .map((method) => ({
        id: method.id,
        amount: required(method.raw_amount, `shipping ${method.id}`),
        is_tax_inclusive: method.is_tax_inclusive ?? null,
        tax_lines: method.tax_lines ?? null,
        adjustments: currentAdjustments(method.adjustments, order.version),
      })),
    credits: present(order.credit_lines)
      .filter((row) => row.version === order.version)
      .map((row) => required(row.raw_amount, "a credit line")),
    payments: present(order.payment_collections).map((row) => ({
      captured: row.raw_captured_amount ?? 0,
      refunded: row.raw_refunded_amount ?? 0,
    })),
  }
}
