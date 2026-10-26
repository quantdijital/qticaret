import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { FulfillmentEvents } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { syncFreeShippingWorkflow } from "../workflows/promotions/free-shipping"

/**
 * A shipping option made or changed (in Medusa Admin, say) gets the shop's
 * free shipping price too (F4.5). Writing it changes the option again;
 * the second pass finds nothing to do, so it stops there.
 */
export default async function freeShipping({ event, container }: SubscriberArgs<{ id: string }>) {
  try {
    await syncFreeShippingWorkflow(container).run({ input: { option_ids: [event.data.id] } })
  } catch (error) {
    // The settings save syncs every option; one missed here is caught at the next save
    logger.warn({
      event: "promotions.free_shipping_sync_failed",
      shippingOptionId: event.data.id,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = {
  event: [FulfillmentEvents.SHIPPING_OPTION_CREATED, FulfillmentEvents.SHIPPING_OPTION_UPDATED],
}
