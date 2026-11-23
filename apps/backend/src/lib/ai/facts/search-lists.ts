import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { filterKeysOf } from "../../seo/facets"
import { todayIn } from "../../seo/facets-dated"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { CATALOG_BOOKING } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import {
  MAX_SEARCH_ATTRIBUTES,
  MAX_SEARCH_CATEGORIES,
  MAX_SEARCH_OPTIONS,
} from "../search-intent/types"
import type { SearchAttribute, SearchCategory, SearchLists } from "../search-intent/types"
import { shownLineage } from "./category-tree"
import type { TreeCategory } from "./category-tree"
import type { FactsContainer } from "./types"

/**
 * The shop's closed lists a storefront sentence is read against (adr/0077
 * §7): what a shopper already sees and the search already takes. Shown
 * categories only (none internal or closed up its tree), by handle; the
 * public, filterable choice attributes whose key a listing reads in its
 * URL, with their options; and whether the shop sells dated products.
 */

// Category rows read to walk their trees: far more than any shop keeps
const MAX_CATEGORY_ROWS = 2000

interface CategoryRow extends TreeCategory {
  handle?: string | null
}

interface DefinitionRow {
  key: string
  label: string
  options?: unknown
}

const isOption = (value: unknown): value is { value: string; label: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { value?: unknown }).value === "string" &&
  typeof (value as { label?: unknown }).label === "string"

async function searchCategories(container: FactsContainer): Promise<SearchCategory[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "is_active", "is_internal", "parent_category_id"],
    pagination: { take: MAX_CATEGORY_ROWS },
  })
  const rows = data as CategoryRow[]
  const byId = new Map(rows.map((row) => [row.id, row]))
  return rows
    .flatMap((row) => {
      const lineage = row.handle ? shownLineage(row, byId) : null
      if (!lineage || !row.handle) {
        return []
      }
      const parent = lineage[1]
      return [{ handle: row.handle, name: parent ? `${parent.name} > ${row.name}` : row.name }]
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .slice(0, MAX_SEARCH_CATEGORIES)
}

/** One entry per key (templates may share one), its options merged in their order. */
async function searchAttributes(container: FactsContainer): Promise<SearchAttribute[]> {
  const rows = (await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .listAttributeDefinitions(
      { is_filterable: true, is_public: true, type: ["select", "multi_select"] },
      { select: ["key", "label", "options"], order: { rank: "ASC" } }
    )) as DefinitionRow[]
  const keys = filterKeysOf(rows.map((row) => row.key))
  const byKey = new Map<string, SearchAttribute & { values: { value: string; label: string }[] }>()
  for (const row of rows) {
    if (!keys.has(row.key)) {
      continue
    }
    const entry = byKey.get(row.key) ?? { key: row.key, label: row.label, values: [] }
    const options = Array.isArray(row.options) ? row.options.filter(isOption) : []
    for (const option of options) {
      if (
        entry.values.length < MAX_SEARCH_OPTIONS &&
        !entry.values.some((each) => each.value === option.value)
      ) {
        entry.values.push({ value: option.value, label: option.label })
      }
    }
    byKey.set(row.key, entry)
  }
  return [...byKey.values()]
    .filter((each) => each.values.length > 0)
    .slice(0, MAX_SEARCH_ATTRIBUTES)
}

export async function searchListsOf(
  container: FactsContainer,
  now: Date = new Date()
): Promise<SearchLists> {
  const [categories, attributes, booking] = await Promise.all([
    searchCategories(container),
    searchAttributes(container),
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(CATALOG_BOOKING),
  ])
  return { categories, attributes, today: todayIn(now), booking }
}
