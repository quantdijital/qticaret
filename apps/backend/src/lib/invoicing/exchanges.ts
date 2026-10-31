import { MathBN } from "@medusajs/framework/utils"
import type { MedusaAmount } from "../money"
import type { InvoiceOrder } from "./draft"
import { returnedOrder } from "./returns"
import type { ReturnedLine } from "./returns"

type Rows<T> = (T | null)[] | null | undefined

/** An exchange of the order (adr/0032 §6) as Medusa keeps it: the lines it added. */
export interface InvoiceExchange {
  id: string
  canceled_at?: string | Date | null
  additional_items?: Rows<{ item_id?: string | null; quantity?: MedusaAmount | null }>
}

export interface ExchangedOrder extends InvoiceOrder {
  exchanges?: Rows<InvoiceExchange>
}

/** What an order's exchanges are read with (Query's `order_exchange`, by the order). */
export const EXCHANGE_FIELDS = [
  "id",
  "canceled_at",
  "additional_items.item_id",
  "additional_items.quantity",
]

/** The lines each exchange added to the order, by the exchange; a canceled one added none. */
export function exchangeLines(order: Pick<ExchangedOrder, "exchanges">) {
  const byExchange = new Map<string, ReturnedLine[]>()
  for (const exchange of order.exchanges ?? []) {
    if (!exchange || exchange.canceled_at) {
      continue
    }
    const lines = (exchange.additional_items ?? []).flatMap((item) => {
      const quantity = MathBN.convert(item?.quantity ?? 0).toNumber()
      return item?.item_id && quantity > 0 ? [{ line_item_id: item.item_id, quantity }] : []
    })
    byExchange.set(exchange.id, lines)
  }
  return byExchange
}

/** The exchange that added the line; null for a line of the first sale. */
export function exchangeOfLine(order: Pick<ExchangedOrder, "exchanges">, lineId: string) {
  for (const [exchangeId, lines] of exchangeLines(order)) {
    if (lines.some((line) => line.line_item_id === lineId)) {
      return exchangeId
    }
  }
  return null
}

/**
 * The order as it was first sold (the accountant, 2026-10-31,
 * docs/mali-musavir-sorulari.md 5.4: an exchange is a return and a new
 * sale): the lines exchanges added are left out, each its exchange's own
 * sale. The lines given back stay: their return has its own document.
 */
export function firstSaleOrder<T extends ExchangedOrder>(order: T): T {
  const added = new Set([...exchangeLines(order).values()].flat().map((line) => line.line_item_id))
  if (added.size === 0) {
    return order
  }
  return { ...order, items: (order.items ?? []).filter((item) => !added.has(item?.id ?? "")) }
}

/**
 * An exchange's new sale: only the lines it added, at their quantity and
 * the price Medusa added them at; no shipping, as the new parcel is the
 * shop's (adr/0032 §6).
 */
export function exchangeSaleOrder<T extends ExchangedOrder>(order: T, exchangeId: string): T {
  return returnedOrder(order, exchangeLines(order).get(exchangeId) ?? [], false)
}
