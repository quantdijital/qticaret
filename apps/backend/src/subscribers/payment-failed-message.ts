import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendMessageWorkflow } from "../workflows/messaging/send-message"
import { PAYMENT_FAILED } from "../workflows/payments/events"
import type { PaymentFailedEvent } from "../workflows/payments/events"

/**
 * "Ödemeniz tamamlanamadı" (F9.4): at most one a day for a cart, so a
 * shopper trying card after card hears it once; none once the cart is paid.
 */
export default async function paymentFailedMessage({
  event: { data },
  container,
}: SubscriberArgs<PaymentFailedEvent>) {
  if (!data.cart_id) {
    return
  }
  await sendMessageWorkflow(container).run({
    input: {
      template: "payment.failed",
      resource_id: data.cart_id,
      key: new Date().toISOString().slice(0, 10),
    },
  })
}

export const config: SubscriberConfig = { event: PAYMENT_FAILED }
