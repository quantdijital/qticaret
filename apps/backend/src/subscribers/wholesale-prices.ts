import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { PricingEvents } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { priceSetsOfPrices, variantsOfPriceSets } from "../workflows/pricing/priced-variants"
import { priceListOfEvent } from "../workflows/wholesale/events"
import { syncVariants } from "../workflows/wholesale/sync"

/**
 * A variant's own price written (ADR-0068 §4): its rows on every rated
 * wholesale list are worked out again; a price entered by hand stays. A
 * new variant's first price comes this way too. A list's own row (a
 * wholesale one, a sale) is no variant's own price and passes by. A
 * failure never fails the write: the nightly run catches up.
 */
export default async function wholesalePrices({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    if ((await priceListOfEvent(container, event.name, event.data.id)) !== null) {
      return
    }
    const variantIds = await variantsOfPriceSets(
      container,
      await priceSetsOfPrices(container, [event.data.id])
    )
    if (variantIds.length > 0) {
      await syncVariants(container, variantIds, { ratedOnly: true })
    }
  } catch (error) {
    logger.warn({
      event: "wholesale.price_sync_failed",
      source: event.name,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = {
  event: [PricingEvents.PRICE_CREATED, PricingEvents.PRICE_UPDATED, PricingEvents.PRICE_DELETED],
}
