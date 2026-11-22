import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import {
  dropUnneededShippingWorkflow,
  unneededShippingMethods,
} from "../workflows/checkout/unneeded-shipping"

/**
 * A changed cart's shipping method taken off once nothing in it ships
 * (adr/0076 Ek D5): its last shipped line removed through Medusa's own
 * route, only dated or digital lines left. Read first without the lock:
 * most carts keep their method. A failure is only logged: the payment's
 * start takes the method off too, under the cart's lock.
 */
export default async function cartUnneededShipping({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    if ((await unneededShippingMethods(container, data.id)).length === 0) {
      return
    }
    await dropUnneededShippingWorkflow(container).run({ input: { cart_id: data.id } })
  } catch (error) {
    logger.warn({
      event: "checkout.unneeded_shipping_failed",
      cart_id: data.id,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = { event: "cart.updated" }
