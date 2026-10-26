import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules, PricingEvents } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { recordSellingPricesWorkflow } from "../workflows/pricing/price-history"

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

// A deleted row too: its price set still says whose price it was
const READ = { withDeleted: true } as const

const setsOf = (prices: { price_set_id?: string | null }[]): string[] =>
  prices.flatMap((price) => (price.price_set_id ? [price.price_set_id] : []))

async function priceSetsOf(container: Container, eventName: string, id: string) {
  const pricing = container.resolve(Modules.PRICING)
  let listId: string | null
  if (PRICE_EVENTS.includes(eventName)) {
    const prices = await pricing.listPrices({ id: [id] }, { select: ["price_set_id"], ...READ })
    return setsOf(prices)
  }
  if (LIST_RULE_EVENTS.includes(eventName)) {
    const [rule] = await pricing.listPriceListRules(
      { id: [id] },
      { select: ["price_list_id"], take: 1, ...READ }
    )
    // Selected as the column; the DTO names only the relation
    listId = (rule as { price_list_id?: string | null } | undefined)?.price_list_id ?? null
  } else {
    listId = id
  }
  if (!listId) {
    return []
  }
  const prices = await pricing.listPrices(
    { price_list_id: [listId] },
    { select: ["price_set_id"], ...READ }
  )
  return setsOf(prices)
}

async function variantsOf(container: Container, priceSetIds: string[]): Promise<string[]> {
  if (priceSetIds.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant_price_set",
    fields: ["variant_id"],
    filters: { price_set_id: [...new Set(priceSetIds)] },
  })
  return (data as { variant_id: string }[]).map((link) => link.variant_id)
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
    const variantIds = await variantsOf(container, priceSetIds)
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
