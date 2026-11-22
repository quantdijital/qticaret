import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancellationTermsOf, daysBefore, feeRuleFor } from "../../lib/booking/cancellation"
import type { CancellationTerms } from "../../lib/booking/cancellation"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { planRefund } from "../../lib/orders"
import { BOOKING_MODULE } from "../../modules/booking"
import type { CancelledUse } from "../../modules/booking/refund-uses"
import type BookingModuleService from "../../modules/booking/service"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { readOrderMoney } from "../orders/order-money"
import { returnPolicy } from "../returns/policy"

/**
 * A cancelled departure's share of cash on delivery recorded after its
 * cancel (review O1 of #277): Medusa records the whole payment, the
 * courier may have collected less; the bell says what the departure's
 * lines come to, worked out on the server by the terms it was sold under
 * (its tier copy), never a request's amount. Kuruş.
 */

// Far above any order: the share worked out before the payments cap it
const UNCAPPED = kurus(Number.MAX_SAFE_INTEGER)

/**
 * The share kept from the departure's lines, as its cancel reckoned it:
 * nothing when the shop cancelled the departure (always in full) or no
 * tier applies; the tier for the days left when it was cancelled
 * otherwise. Pure.
 */
export function cashShareFee(facts: {
  slot_status: string
  terms: CancellationTerms
  starts_at: Date
  cancelled_at: Date
  package_travel: boolean
}): number {
  if (facts.slot_status === "cancelled") {
    return 0
  }
  const days = daysBefore(facts.starts_at, facts.cancelled_at, facts.terms.timezone)
  return (
    feeRuleFor(facts.terms.tiers, days, { packageTravel: facts.package_travel })?.fee_percent ?? 0
  )
}

interface ItemRow {
  id: string
  quantity?: unknown
  detail?: { quantity?: unknown } | null
  metadata?: unknown
}

export async function cashShareOf(
  container: MedusaContainer,
  use: CancelledUse,
  now = new Date()
): Promise<Kurus> {
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const [slot] = await bookings.listBookingSlots({ id: use.slot_id }, { take: 1 })
  if (!slot) {
    return kurus(0)
  }
  const [bookable] = await bookings.listBookables({ id: slot.bookable_id }, { take: 1 })
  const fee = cashShareFee({
    slot_status: slot.status,
    terms: cancellationTermsOf(use.cancellation, {
      timezone: bookable?.timezone ?? null,
      tiers: bookable?.cancellation_tiers ?? [],
    }),
    starts_at: new Date(slot.starts_at),
    cancelled_at: use.cancelled_at ?? now,
    package_travel: (await returnPolicy(container)).package_travel,
  })
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    // Medusa fills an item's quantity only with its detail requested
    fields: ["items.id", "items.quantity", "items.detail.quantity", "items.metadata"],
    filters: { id: use.order_id },
  })
  const rows = (data as unknown as { items?: (ItemRow | null)[] | null }[])[0]?.items ?? []
  const refunded = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .refundedLines(use.order_id)
  const items = rows.flatMap((item) => {
    if (!item || bookingMarkOf(item.metadata)?.slot_id !== use.slot_id) {
      return []
    }
    const left =
      Number(item.detail?.quantity ?? item.quantity ?? 0) - (refunded.units.get(item.id) ?? 0)
    return left > 0 ? [{ id: item.id, quantity: left }] : []
  })
  if (items.length === 0) {
    return kurus(0)
  }
  const money = await readOrderMoney(container, use.order_id)
  try {
    return planRefund(money.lines, refunded, { items, fee_percent: fee }, UNCAPPED).total
  } catch (error) {
    // Everything kept, or nothing left to give
    if ((error as { safeMessage?: string }).safeMessage === "orders.refund_empty") {
      return kurus(0)
    }
    throw error
  }
}
