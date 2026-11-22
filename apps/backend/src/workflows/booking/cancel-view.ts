import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { toMedusaAmount } from "../../lib/money"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { customerCancelRefusal, planBookingCancel } from "./cancel-plan"
import type { CancelMode } from "./cancel-plan"

/**
 * An order's departures with what cancelling each would give back now
 * (adr/0076 Ek D7a): the shopper's account page and staff's order page
 * read this before they confirm. Lira as Medusa gives amounts; worked out
 * on the server, nothing is changed. No personal data.
 */

export interface DepartureCancelView {
  slot_id: string
  starts_at: string
  timezone: string
  /** Line titles of the departure, as the order sold them. */
  titles: string[]
  cancelled: boolean
  /** Whether the asker may cancel it now, and why not (an i18n key). */
  cancellable: boolean
  refusal: string | null
  days_before: number | null
  /** The share kept; null: no tier set (staff may still give all of it back). */
  fee_percent: number | null
  paid: string
  refund: string
  refund_within_days: number | null
}

interface ItemRow {
  id: string
  title?: string | null
  metadata?: unknown
}

/** The order's departures, in date order, each with its cancel's plan for `by` now. */
export async function departureCancelViews(
  container: MedusaContainer,
  input: { order_id: string; by: "customer" | "staff"; mode: CancelMode; now?: Date }
): Promise<{ currency_code: string; departures: DepartureCancelView[] }> {
  const now = input.now ?? new Date()
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "currency_code", "items.id", "items.title", "items.metadata"],
    filters: { id: input.order_id },
  })
  const order = (data as { currency_code?: string; items?: (ItemRow | null)[] | null }[])[0]
  const bySlot = new Map<string, { starts_at: string; titles: string[] }>()
  for (const item of order?.items ?? []) {
    const mark = item ? bookingMarkOf(item.metadata) : null
    if (!item || !mark) {
      continue
    }
    const entry = bySlot.get(mark.slot_id) ?? { starts_at: mark.starts_at, titles: [] }
    if (item.title && !entry.titles.includes(item.title)) {
      entry.titles.push(item.title)
    }
    bySlot.set(mark.slot_id, entry)
  }
  const departures: DepartureCancelView[] = []
  for (const [slotId, line] of bySlot) {
    const plan = await planBookingCancel(container, {
      order_id: input.order_id,
      slot_id: slotId,
      mode: input.mode,
      now,
    })
    if (!plan) {
      departures.push(cancelledView(slotId, line))
      continue
    }
    const refusal =
      input.by === "customer"
        ? customerCancelRefusal(plan, now)
        : plan.rule
          ? null
          : "booking.cancel_unavailable"
    departures.push({
      slot_id: slotId,
      starts_at: plan.starts_at.toISOString(),
      timezone: plan.timezone,
      titles: line.titles,
      cancelled: false,
      cancellable: refusal === null,
      refusal,
      days_before: plan.days_before,
      fee_percent: plan.rule?.fee_percent ?? null,
      paid: toMedusaAmount(plan.paid),
      refund: toMedusaAmount(plan.refund),
      refund_within_days: plan.refund_within_days,
    })
  }
  departures.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return { currency_code: order?.currency_code ?? "try", departures }
}

function cancelledView(
  slotId: string,
  line: { starts_at: string; titles: string[] }
): DepartureCancelView {
  return {
    slot_id: slotId,
    starts_at: line.starts_at,
    timezone: "Europe/Istanbul",
    titles: line.titles,
    cancelled: true,
    cancellable: false,
    refusal: null,
    days_before: null,
    fee_percent: null,
    paid: "0.00",
    refund: "0.00",
    refund_within_days: null,
  }
}

/** Whether the order holds a booking at all (the routes answer 404 when it does not). */
export async function orderHasBookings(
  container: MedusaContainer,
  orderId: string
): Promise<boolean> {
  const [booking] = await container
    .resolve<BookingModuleService>(BOOKING_MODULE)
    .listBookings({ order_id: orderId }, { take: 1, select: ["id"] })
  return Boolean(booking)
}
