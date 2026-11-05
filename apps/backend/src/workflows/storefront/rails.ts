import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import type { BodySection } from "../../lib/storefront/layout"
import { SALE_POOL, deepestFirst, topUp } from "../../lib/storefront/rails"
import type { RailPick } from "../../lib/storefront/rails"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { CURRENCY } from "../catalog/prices"
import { priceDisplays } from "../pricing/price-display"
import { saleProductIds } from "../pricing/sale-products"
import { bestSellerIds } from "./best-sellers"

/**
 * The home page's rails the server picks (adr/0049 Ek 2026-11-05), for
 * the shopper's sales channels:
 *
 * - `on_sale`: exactly what `/kampanyalar` lists (the search index's
 *   `on_sale`), the deepest discount first as the cards strike it through
 *   (the newest first among equal ones), weighed among the newest
 *   `SALE_POOL` on sale;
 * - `best_sellers`: the most units sold in paid orders over the section's
 *   days; too few sales, and the newest products make up the rest
 *   (`filled_with_newest`).
 *
 * The storefront loads the products by id, prices and stock live. A rail
 * the backend cannot pick is logged and shown as it can be: a sale rail
 * empty (the storefront leaves it out), a best-seller one the newest.
 */

type Channels = readonly string[] | null

const indexOf = (container: MedusaContainer) =>
  container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)

/** The newest products shown in these channels, at most `limit`. */
async function newestIds(container: MedusaContainer, channels: Channels, limit: number) {
  const { ids } = await indexOf(container).listing({
    channels: channels && [...channels],
    scope: {},
    text: null,
    filters: { brands: null, options: [], in_stock: false },
    price: { key: "", min: null, max: null },
    sort: "newest",
    page: { offset: 0, limit },
  })
  return ids
}

async function saleRail(
  container: MedusaContainer,
  channels: Channels,
  limit: number
): Promise<RailPick> {
  const ids = await saleProductIds(container, SALE_POOL, channels)
  if (ids.length === 0) {
    return { product_ids: [], filled_with_newest: false }
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "product_id"],
    filters: { product_id: ids },
  })
  const variants = (data as { id: string; product_id: string | null }[]).flatMap((variant) =>
    variant.product_id ? [{ id: variant.id, product_id: variant.product_id }] : []
  )
  const displays = await priceDisplays(
    container,
    variants.map((variant) => variant.id),
    CURRENCY
  )
  return {
    product_ids: deepestFirst(ids, variants, displays).slice(0, limit),
    filled_with_newest: false,
  }
}

async function bestSellerRail(
  container: MedusaContainer,
  days: number,
  channels: Channels,
  limit: number
): Promise<RailPick> {
  let ranked: string[] = []
  try {
    ranked = await bestSellerIds(container, days, channels)
  } catch (error) {
    logger.warn({ event: "storefront.best_sellers_failed", err: errorSummary(error) })
  }
  const newest =
    ranked.length < limit ? await newestIds(container, channels, limit + ranked.length) : []
  return topUp(ranked, newest, limit)
}

/** A section's pick, by its id; null for a section whose products the storefront fetches itself. */
async function pickOf(
  container: MedusaContainer,
  section: BodySection,
  channels: Channels
): Promise<[string, RailPick] | null> {
  if (section.type !== "products") {
    return null
  }
  const { source, limit } = section
  try {
    if (source.kind === "on_sale") {
      return [section.id, await saleRail(container, channels, limit)]
    }
    if (source.kind === "best_sellers") {
      return [section.id, await bestSellerRail(container, source.days, channels, limit)]
    }
  } catch (error) {
    logger.warn({ event: "storefront.rail_failed", kind: source.kind, err: errorSummary(error) })
    return [section.id, { product_ids: [], filled_with_newest: false }]
  }
  return null
}

/** The picked rails among these sections, by section id; each picked once, all at once. */
export async function railPicks(
  container: MedusaContainer,
  sections: readonly BodySection[],
  channels: Channels
): Promise<Map<string, RailPick>> {
  const picks = await Promise.all(sections.map((section) => pickOf(container, section, channels)))
  return new Map(picks.filter((pick) => pick !== null))
}
