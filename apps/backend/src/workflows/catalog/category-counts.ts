import type { MedusaContainer } from "@medusajs/framework/types"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { categoryRows, subtreeIn } from "../content/landing-facet"

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
  channels: Channels
): Promise<Record<string, number>> {
  const rows = await categoryRows(container)
  const shown = rows.filter((row) => row.is_active === true && row.is_internal !== true)
  return container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).categoryCounts(
    shown.map((row) => ({ id: row.id, ids: subtreeIn(rows, row.id, true) })),
    channels && [...channels]
  )
}

// Every visitor asks the same: a minute's answer per publishable key's
// channels (the shop's keys, not the visitor's words), as the design's is
const counted = createTtlCache<Record<string, number>>({ ttlMs: 60_000, maxEntries: 8 })

/** `countCategories`, kept a minute per set of channels. */
export function storeCategoryCounts(
  container: MedusaContainer,
  channels: Channels
): Promise<Record<string, number>> {
  const key = channels ? [...new Set(channels)].sort().join(",") : "*"
  return counted(key, () => countCategories(container, channels))
}
