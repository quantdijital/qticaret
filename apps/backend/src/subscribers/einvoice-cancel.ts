import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { requestInvoiceCancelWorkflow } from "../workflows/einvoice/cancel-invoice"

/**
 * A canceled order's invoice undone at its program, or left for a return
 * document (F8, adr/0034 §10). A failure is logged: the order's invoice
 * card still shows it issued, for staff to see.
 */
export default async function einvoiceCancel({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await requestInvoiceCancelWorkflow(container).run({ input: { order_id: data.id } })
  } catch (error) {
    logger.warn({ event: "einvoice.cancel_request_failed", err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = { event: "order.canceled" }
