import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendMessageWorkflow } from "../workflows/messaging/send-message"

/**
 * "Kargoya verildi" when the parcel is handed over, "Teslim edildi" when
 * it arrives (F9.4). A parcel shipped without notice stays silent: the
 * loader reads the shop's choice from the fulfillment.
 */
export default async function parcelMessages({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification === true) {
    return
  }
  await sendMessageWorkflow(container).run({
    input: {
      template: name === "delivery.created" ? "order.delivered" : "order.shipped",
      resource_id: data.id,
    },
  })
}

export const config: SubscriberConfig = { event: ["shipment.created", "delivery.created"] }
