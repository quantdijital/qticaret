import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { orderOf, queueSaleInvoice } from "../workflows/einvoice/queue-invoices"
import type { InvoiceMoment } from "../workflows/einvoice/queue-invoices"

const MOMENTS: Readonly<
  Record<string, { moment: InvoiceMoment; of: "order" | "fulfillment" | "payment" }>
> = {
  "order.placed": { moment: "placed", of: "order" },
  "payment.captured": { moment: "paid", of: "payment" },
  "shipment.created": { moment: "shipped", of: "fulfillment" },
  "delivery.created": { moment: "delivered", of: "fulfillment" },
}

/**
 * An order's sale invoice, queued when it is due by the shop's setting
 * (F8, adr/0034 §8). Queuing is one insert a repeated event leaves alone;
 * the order flow never waits on the program. A failure here is logged:
 * the hourly sweep (jobs/einvoice-issue.ts) queues what an event missed.
 */
export default async function einvoiceQueue({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const found = MOMENTS[name]
  if (!found) {
    return
  }
  try {
    const orderId = found.of === "order" ? data.id : await orderOf(container, found.of, data.id)
    if (orderId) {
      await queueSaleInvoice(container, orderId, found.moment)
    }
  } catch (error) {
    logger.warn({ event: "einvoice.queue_failed", source: name, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "payment.captured", "shipment.created", "delivery.created"],
}
