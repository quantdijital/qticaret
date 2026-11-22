import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"

type Container = Pick<MedusaContainer, "resolve">

// The kinds this file rings, `booking.<alert>` on the bell
export type BookingAlert = "confirm_failed" | "travelers_attach_failed"

/** A booking alert on an order's bell: ids and the order number only; never fails its caller. */
async function ringOrderBell(
  container: Container,
  orderId: string,
  alert: BookingAlert
): Promise<void> {
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
      data: {
        kind: `booking_${alert}`,
        order_id: orderId,
        display_id: order,
        ...notificationText(`booking.${alert}`, { order }),
      },
    })
  } catch (error) {
    logger.warn({ event: "booking.alert_failed", order_id: orderId, err: errorSummary(error) })
  }
}

/**
 * Rings the panel's bell for a placed order whose places could not be
 * confirmed (adr/0076 Ek, `booking.confirm_failed`): the order stands and
 * is paid, the departure has no room for it; staff call the shopper, move
 * the date or refund. An alert that cannot be written is logged; it never
 * fails the confirmation.
 */
export const alertConfirmFailed = (container: Container, orderId: string): Promise<void> =>
  ringOrderBell(container, orderId, "confirm_failed")

/**
 * Rings the panel's bell for a booking whose travelers the reconcile job
 * could not attach after its tries (adr/0076 §7,
 * `booking.travelers_attach_failed`): the booking shows no travelers;
 * staff ask the shopper for them. Once per order.
 */
export const alertTravelersAttachFailed = (container: Container, orderId: string): Promise<void> =>
  ringOrderBell(container, orderId, "travelers_attach_failed")
