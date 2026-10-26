import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules, PricingEvents } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { recordSellingPricesWorkflow } from "../workflows/pricing/price-history"
import {
  priceSetsOfLists,
  priceSetsOfPrices,
  variantsOfPriceSets,
} from "../workflows/pricing/priced-variants"

type Container = SubscriberArgs["container"]

const PRICE_EVENTS: readonly string[] = [
  PricingEvents.PRICE_CREATED,
  PricingEvents.PRICE_UPDATED,
  PricingEvents.PRICE_DELETED,
]
const LIST_EVENTS: readonly string[] = [
  PricingEvents.PRICE_LIST_CREATED,
  PricingEvents.PRICE_LIST_UPDATED,
  PricingEvents.PRICE_LIST_DELETED,
]
const LIST_RULE_EVENTS: readonly string[] = [
  PricingEvents.PRICE_LIST_RULE_CREATED,
  PricingEvents.PRICE_LIST_RULE_UPDATED,
  PricingEvents.PRICE_LIST_RULE_DELETED,
]

async function priceSetsOf(container: Container, eventName: string, id: string) {
  if (PRICE_EVENTS.includes(eventName)) {
    return priceSetsOfPrices(container, [id])
  }
  let listId: string | null = id
  if (LIST_RULE_EVENTS.includes(eventName)) {
    const [rule] = await container
      .resolve(Modules.PRICING)
      .listPriceListRules({ id: [id] }, { select: ["price_list_id"], take: 1, withDeleted: true })
    // Selected as the column; the DTO names only the relation
    listId = (rule as { price_list_id?: string | null } | undefined)?.price_list_id ?? null
  }
  return listId ? priceSetsOfLists(container, [listId]) : []
}

/**
 * A price, a price list or one of its rules written (F4.2, ADR-0023): the
 * variants it prices have their selling prices recorded where they
 * changed. The events carry only ids; a failure never fails the write,
 * and the hourly check catches up.
 */
export default async function priceHistory({ event, container }: SubscriberArgs<{ id: string }>) {
  try {
    const priceSetIds = await priceSetsOf(container, event.name, event.data.id)
    const variantIds = await variantsOfPriceSets(container, priceSetIds)
    if (variantIds.length > 0) {
      await recordSellingPricesWorkflow(container).run({
        input: { variant_ids: variantIds, reason: "price_change" },
      })
    }
  } catch (error) {
    logger.warn({
      event: "price_history.record_failed",
      source: event.name,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = {
  event: [...PRICE_EVENTS, ...LIST_EVENTS, ...LIST_RULE_EVENTS],
}
