import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { toMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { notificationText } from "../../lib/notifications/messages"

type Container = Pick<MedusaContainer, "resolve">

// The kinds this file rings, `booking.<alert>` on the bell
export type BookingAlert =
  | "confirm_failed"
  | "travelers_attach_failed"
  | "refund_by_hand"
  | "cash_share_by_hand"
  | "departure_refund_given_up"

// Money owed by hand: a bell that cannot be written is an error, not a warning
const MONEY_ALERTS: readonly BookingAlert[] = ["refund_by_hand", "cash_share_by_hand"]

/** The bell's key rung once: per order, and per departure when given. */
export const bellKey = (alert: BookingAlert, orderId: string, slotId?: string): string =>
  `booking.${alert}:${orderId}${slotId ? `:${slotId}` : ""}`

/**
 * A booking alert on an order's bell: ids, the order number and a
 * departure's id only (and an amount the server worked out); never fails
 * its caller. Whether it was written (or written before, its key).
 */
async function ringOrderBell(
  container: Container,
  orderId: string,
  alert: BookingAlert,
  extra: { slot_id?: string; once?: boolean; amount?: Kurus } = {}
): Promise<boolean> {
  // Once per order (and departure): rung again, Medusa skips the same key (adr/0076 Ek D7a)
  const key = extra.once ? bellKey(alert, orderId, extra.slot_id) : null
  try {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["display_id"],
      filters: { id: orderId },
    })
    const order = String((data[0] as { display_id?: number } | undefined)?.display_id ?? "")
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: `booking.${alert}`,
      resource_id: orderId,
      ...(key ? { idempotency_key: key } : {}),
      data: {
        kind: `booking_${alert}`,
        order_id: orderId,
        display_id: order,
        ...(extra.slot_id ? { slot_id: extra.slot_id } : {}),
        ...(extra.amount !== undefined ? { amount: toMedusaAmount(extra.amount) } : {}),
        ...notificationText(`booking.${alert}`, {
          order,
          ...(extra.amount !== undefined ? { amount: toMedusaAmount(extra.amount) } : {}),
        }),
      },
    })
    return true
  } catch (error) {
    const entry = {
      event: "booking.alert_failed",
      alert,
      order_id: orderId,
      err: errorSummary(error),
    }
    if (MONEY_ALERTS.includes(alert)) {
      logger.error(entry)
    } else {
      logger.warn(entry)
    }
    return false
  }
}

/**
 * Rings the panel's bell for a placed order whose places could not be
 * confirmed (adr/0076 Ek, `booking.confirm_failed`): the order stands and
 * is paid, the departure has no room for it; staff call the shopper, move
 * the date or refund. An alert that cannot be written is logged; it never
 * fails the confirmation.
 */
export const alertConfirmFailed = (container: Container, orderId: string): Promise<boolean> =>
  ringOrderBell(container, orderId, "confirm_failed")

/**
 * Rings the panel's bell for a booking whose travelers the reconcile job
 * could not attach after its tries (adr/0076 §7,
 * `booking.travelers_attach_failed`): the booking shows no travelers;
 * staff ask the shopper for them. Once per order.
 */
export const alertTravelersAttachFailed = (container: Container, orderId: string): Promise<void> =>
  ringOrderBell(container, orderId, "travelers_attach_failed").then(() => undefined)

/**
 * Rings the panel's bell for a departure cancelled whose money was not
 * sent on its own (adr/0076 Ek D7a, review O1/O2,
 * `booking.refund_by_hand`): a bank transfer or cash taken by hand, a
 * gift card or store credit used, or a share above what the payments
 * hold. The places are given back; staff refund it by hand. Once per
 * departure: a cancel tried again rings it again safely.
 */
export const alertRefundByHand = (
  container: Container,
  orderId: string,
  slotId: string
): Promise<boolean> =>
  ringOrderBell(container, orderId, "refund_by_hand", { slot_id: slotId, once: true })

/**
 * Rings the panel's bell for a departure cancelled before its cash on
 * delivery was recorded (review O1 of #277, `booking.cash_share_by_hand`):
 * Medusa records the whole payment; if the courier collected all of it,
 * the departure's share (worked out on the server, `amount` in lira) is
 * refunded by hand. Once per departure.
 */
export const alertCashShareByHand = (
  container: Container,
  orderId: string,
  slotId: string,
  amount: Kurus
): Promise<boolean> =>
  ringOrderBell(container, orderId, "cash_share_by_hand", { slot_id: slotId, once: true, amount })

/**
 * Rings the panel's bell for a booking on a cancelled departure whose
 * refund failed every try of the day (review O4,
 * `booking.departure_refund_given_up`): the booking stands, its money
 * kept; staff look at the order. Tried again the next day.
 */
export const alertDepartureRefundGivenUp = (
  container: Container,
  orderId: string,
  slotId: string
): Promise<boolean> =>
  ringOrderBell(container, orderId, "departure_refund_given_up", { slot_id: slotId })
