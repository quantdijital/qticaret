import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { priceSetsOfLists, variantsOfPriceSets } from "../pricing/priced-variants"
import { productsOfVariants } from "./affected"
import { buildIfEmpty, drainSearchIndex, queueSearchProducts, rebuildSearchIndex } from "./drain"
import { recentOrderCounts } from "./popularity"
import { queueOnOfferChange } from "./promotion-state"

/**
 * The index's upkeep (adr/0056): what no event tells of. Each minute: a
 * price list that began or ended (its products' prices changed with no
 * write), the automatic promotions changed (a campaign began or ended, a
 * budget ran out: every product's `on_sale` again, promotion-state.ts),
 * claims a stopped process left, and the first build of a shop's index.
 * Each night: every product indexed again (what a missed event or a
 * template's change left behind), the popularity of the last 30 days
 * counted again, and the word dictionary's counts made exact.
 */

// Boundaries looked back over: a run that starts late still finds its own
const BOUNDARY_WINDOW_MS = 5 * 60_000

/** Products of the price lists that began or ended in the window. */
async function productsAtListBoundaries(container: MedusaContainer, now: Date) {
  const pricing = container.resolve(Modules.PRICING)
  const from = new Date(now.getTime() - BOUNDARY_WINDOW_MS).toISOString()
  const to = now.toISOString()
  const select = { select: ["id"], take: null }
  const [starting, ending] = await Promise.all([
    pricing.listPriceLists({ starts_at: { $gt: from, $lte: to } }, select),
    pricing.listPriceLists({ ends_at: { $gt: from, $lte: to } }, select),
  ])
  const lists = [...new Set([...starting, ...ending].map((list) => list.id))]
  if (lists.length === 0) {
    return []
  }
  return productsOfVariants(
    container,
    await variantsOfPriceSets(container, await priceSetsOfLists(container, lists))
  )
}

/** The minute's upkeep; returns the products indexed. */
export async function searchIndexMinute(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<number> {
  await buildIfEmpty(container)
  await queueSearchProducts(container, await productsAtListBoundaries(container, now))
  await queueOnOfferChange(container, now)
  return drainSearchIndex(container)
}

/** The night's upkeep: popularity counted again, every product indexed, words recounted. */
export async function searchIndexNightly(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<{ indexed: number; popularity: number }> {
  const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
  const popularity = await index.setPopularity(await recentOrderCounts(container, now))
  const indexed = await rebuildSearchIndex(container)
  return { indexed, popularity }
}
