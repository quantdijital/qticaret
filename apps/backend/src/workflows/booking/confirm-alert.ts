import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Rings the panel's bell for a placed order whose places could not be
 * confirmed (adr/0076 Ek, `booking.confirm_failed`): the order stands and
 * is paid, the departure has no room for it; staff call the shopper, move
 * the date or refund. Ids and the order number only. An alert that cannot
 * be written is logged; it never fails the confirmation.
 */
export async function alertConfirmFailed(container: Container, orderId: string): Promise<void> {
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
      trigger_type: "booking.confirm_failed",
      resource_id: orderId,
      data: {
        kind: "booking_confirm_failed",
        order_id: orderId,
        display_id: order,
        ...notificationText("booking.confirm_failed", { order }),
      },
    })
  } catch (error) {
    logger.warn({ event: "booking.alert_failed", order_id: orderId, err: errorSummary(error) })
  }
}
