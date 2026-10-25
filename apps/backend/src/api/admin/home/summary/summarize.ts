import type { OrderDetailDTO } from "@medusajs/framework/types"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"
import { fromMedusaAmount, sumKurus, toMedusaAmount } from "../../../../lib/money"
import type { Kurus, MedusaAmount } from "../../../../lib/money"

/**
 * The home page's numbers (docs/17), worked out from orders read without
 * personal data. Kept apart from the reads so the rules are unit-tested.
 */

export interface OpenOrder {
  currency_code: string
  payment_collections?: OrderDetailDTO["payment_collections"] | null
  fulfillments?: ({ canceled_at?: unknown } | null)[] | null
}

export interface DayOrder {
  currency_code: string
  total: MedusaAmount
}

// Payment taken or held: the order is the shop's to send
const PAID = new Set(["captured", "partially_captured", "authorized", "partially_authorized"])

/**
 * Paid orders with no live shipment yet: nothing packed, or every shipment
 * canceled. Payment status as the dashboard's order list works it out.
 */
export function awaitingShipment(orders: readonly OpenOrder[]): number {
  return orders.filter((order) => {
    const paid = PAID.has(
      getLastPaymentStatus({
        currency_code: order.currency_code,
        payment_collections: order.payment_collections ?? [],
      } as OrderDetailDTO)
    )
    const shipping = (order.fulfillments ?? []).some((item) => item && !item.canceled_at)
    return paid && !shipping
  }).length
}

/** The day's sales per currency, summed in kuruş, as Medusa amount strings. */
export function salesByCurrency(
  orders: readonly DayOrder[]
): { currency_code: string; amount: string }[] {
  const byCurrency = new Map<string, Kurus[]>()
  for (const order of orders) {
    const amounts = byCurrency.get(order.currency_code) ?? []
    amounts.push(fromMedusaAmount(order.total, { allowRounding: true }))
    byCurrency.set(order.currency_code, amounts)
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency_code, amounts]) => ({
      currency_code,
      amount: toMedusaAmount(sumKurus(amounts)),
    }))
}

/**
 * Midnight today in Turkey (UTC+3 all year since 2016), the start of
 * "today's sales"; a tenant time zone comes with F19's other countries.
 */
export function startOfTurkishDay(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ""
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+03:00`)
}
