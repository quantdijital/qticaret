import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { PricingEvents } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { BRAND_DELETED, BRAND_SAVED } from "../workflows/brands/workflows"
import { CATALOG_PRODUCT_SAVED } from "../workflows/catalog/events"
import { productsOfEvent } from "../workflows/search/affected"
import { drainSearchIndex, queueAllProducts, queueSearchProducts } from "../workflows/search/drain"

/**
 * What search reads of a product changed (adr/0056): its products are
 * marked to be indexed again, after the change is done; the drain does
 * the work. A failure here never touches the change; the nightly rebuild
 * catches up.
 */
export default async function searchIndex({
  event,
  container,
}: SubscriberArgs<{ id?: string | string[] }>) {
  const ids = [event.data.id ?? []].flat()
  try {
    for (const id of ids) {
      const products = await productsOfEvent(container, event.name, id)
      if (products === "all") {
        await queueAllProducts(container)
        await drainSearchIndex(container)
        return
      }
      await queueSearchProducts(container, products)
    }
  } catch (error) {
    logger.warn({ event: "search_index.mark_failed", source: event.name, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
    "product-variant.created",
    "product-variant.updated",
    "product-variant.deleted",
    "product-category.updated",
    "product-category.deleted",
    BRAND_SAVED,
    BRAND_DELETED,
    CATALOG_PRODUCT_SAVED,
    PricingEvents.PRICE_CREATED,
    PricingEvents.PRICE_UPDATED,
    PricingEvents.PRICE_DELETED,
    PricingEvents.PRICE_LIST_CREATED,
    PricingEvents.PRICE_LIST_UPDATED,
    PricingEvents.PRICE_LIST_DELETED,
    PricingEvents.PRICE_LIST_RULE_CREATED,
    PricingEvents.PRICE_LIST_RULE_UPDATED,
    PricingEvents.PRICE_LIST_RULE_DELETED,
    "inventory-level.created",
    "inventory-level.updated",
    "inventory-level.deleted",
    "reservation-item.created",
    "reservation-item.updated",
    "reservation-item.deleted",
    "region.created",
    "region.updated",
  ],
}
