import type { MedusaContainer } from "@medusajs/framework/types"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { categoryRows, subtreeIn } from "../content/landing-facet"
import { hidesOutOfStock } from "../seo/listing-stock"

type Channels = readonly string[] | null

/**
 * How many products every shown category lists (adr/0049 Ek 2026-11-14
 * §10 karar 7b): the category's own and those of the shown categories
 * under it, published, in the shopper's sales channels: the rule a
 * category's listing counts by (its scope is the same shown subtree, its
 * rows the same search index), so a tile's number is its page's. One
 * statement for the whole tree (`categoryCounts`), never one per category.
 * A hidden category has no count.
 */
export async function countCategories(
  container: MedusaContainer,
  channels: Channels,
  inStockOnly = false
): Promise<Record<string, number>> {
  const rows = await categoryRows(container)
  const shown = rows.filter((row) => row.is_active === true && row.is_internal !== true)
  return container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).categoryCounts(
    shown.map((row) => ({ id: row.id, ids: subtreeIn(rows, row.id, true) })),
    channels && [...channels],
    inStockOnly
  )
}

// Every visitor asks the same: a minute's answer per publishable key's
// channels (the shop's keys, not the visitor's words), as the design's is
const counted = createTtlCache<Record<string, number>>({ ttlMs: 60_000, maxEntries: 8 })

/** `countCategories`, kept a minute per set of channels. */
export async function storeCategoryCounts(
  container: MedusaContainer,
  channels: Channels
): Promise<Record<string, number>> {
  // T1: hiding sold-out products, the tiles count what the listings show
  const hide = await hidesOutOfStock(container)
  const key = `${channels ? [...new Set(channels)].sort().join(",") : "*"}${hide ? ":in-stock" : ""}`
  return counted(key, () => countCategories(container, channels, hide))
}
