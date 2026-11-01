import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, QueryContext } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import { LISTING_PAGE_SIZE, LISTING_PARAMS } from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { baseOf } from "./listing"
import type { Listed } from "./listing"
import { arrange, facetsOf } from "./listing-facets"
import type { ListingFacets, ListingRow } from "./listing-facets"

/**
 * A listing page's products for the storefront (F18 D4, docs/13 §7): the
 * listing's published products in the shopper's sales channels, narrowed
 * by its filters and price range, in its sort, one page of ids; and the
 * filters it can offer with how many products each would show. Worked
 * out in memory over the listing's products: a few thousand at most per
 * listing until search (D10) takes the large ones.
 */

/** A listing past this many products answers its first ones only (a search index's job, D10). */
export const LISTING_SCAN_LIMIT = 3000

export interface ListingProductsInput {
  listed: Listed
  query: ListingQuery
  currency_code: string
  region_id: string | null
  sales_channel_ids: readonly string[]
}

export interface ListingProductsAnswer {
  product_ids: string[]
  count: number
  page: number
  page_size: number
  facets: ListingFacets
}

interface ProductRow {
  id: string
  created_at: string | Date
  sales_channels?: ({ id: string } | null)[] | null
  brand?: { handle: string; name: string } | null
  attribute_values?:
    | ({
        value_text?: string | null
        value_options?: string[] | null
        definition?: { key: string; type: string } | null
      } | null)[]
    | null
  variants?: ({ calculated_price?: { calculated_amount?: number | null } | null } | null)[] | null
}

/** The whole catalogue's listing (`/magaza`): every published product. */
export const ALL_PRODUCTS = "all"

/** The listing's own products before its filters: published, in the base's scope. */
async function baseIds(container: MedusaContainer, listed: Listed): Promise<string[]> {
  const base =
    listed.entity_type === ALL_PRODUCTS ? { where: {}, ids: null } : await baseOf(container, listed)
  if (!base || base.ids?.length === 0) {
    return []
  }
  const products = container.resolve(Modules.PRODUCT)
  const where = { ...base.where, status: "published" as const }
  const config = { select: ["id"], take: LISTING_SCAN_LIMIT, order: { created_at: "DESC" } }
  if (base.ids === null) {
    return (await products.listProducts(where, config)).map((product) => product.id)
  }
  const found: string[] = []
  for (const chunk of chunksOf(base.ids)) {
    found.push(...(await products.listProducts({ ...where, id: chunk }, config)).map((p) => p.id))
  }
  return found.slice(0, LISTING_SCAN_LIMIT)
}

/** What filtering and sorting read of each product: brand, options, lowest price, age. */
async function rowsOf(
  container: MedusaContainer,
  ids: string[],
  input: ListingProductsInput
): Promise<ListingRow[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const channels = new Set(input.sales_channel_ids)
  const pricing = QueryContext({
    currency_code: input.currency_code,
    ...(input.region_id ? { region_id: input.region_id } : {}),
  })
  const rows: ListingRow[] = []
  for (const chunk of chunksOf(ids)) {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "created_at",
        "sales_channels.id",
        "brand.handle",
        "brand.name",
        "attribute_values.value_text",
        "attribute_values.value_options",
        "attribute_values.definition.key",
        "attribute_values.definition.type",
        "variants.calculated_price.calculated_amount",
      ],
      filters: { id: chunk },
      context: { variants: { calculated_price: pricing } },
    })
    for (const product of data as ProductRow[]) {
      const shelved = (product.sales_channels ?? []).some(
        (channel) => channel && channels.has(channel.id)
      )
      if (!shelved) {
        continue
      }
      const options = new Map<string, string[]>()
      for (const value of product.attribute_values ?? []) {
        const definition = value?.definition
        // A single choice keeps its option in `value_text`, a multiple one in `value_options`
        const chosen =
          definition?.type === "select"
            ? value?.value_text
              ? [value.value_text]
              : []
            : (value?.value_options ?? [])
        if (definition?.key && chosen.length > 0) {
          options.set(definition.key, chosen)
        }
      }
      const amounts = (product.variants ?? []).flatMap((variant) => {
        const amount = variant?.calculated_price?.calculated_amount
        return typeof amount === "number" ? [amount] : []
      })
      rows.push({
        id: product.id,
        created_at: new Date(product.created_at).getTime(),
        brand: product.brand ? { handle: product.brand.handle, name: product.brand.name } : null,
        options,
        price: amounts.length ? Math.min(...amounts) : null,
      })
    }
  }
  // The listing's order (newest first) survives the chunks
  const order = new Map(ids.map((id, index) => [id, index]))
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

/** The filterable choice attributes, by key: their labels and option labels, in rank order. */
async function filterDefinitions(container: MedusaContainer) {
  const definitions = await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .listAttributeDefinitions(
      { is_filterable: true, is_public: true, type: ["select", "multi_select"] },
      { select: ["key", "label", "options", "rank"], order: { rank: "ASC" } }
    )
  const byKey = new Map<string, { label: string; options: Map<string, string> }>()
  for (const definition of definitions) {
    if (definition.key === LISTING_PARAMS.brand) {
      continue
    }
    const entry = byKey.get(definition.key) ?? { label: definition.label, options: new Map() }
    for (const option of (definition.options ?? []) as { value: string; label: string }[]) {
      entry.options.set(option.value, option.label)
    }
    byKey.set(definition.key, entry)
  }
  return byKey
}

export async function listingProducts(
  container: MedusaContainer,
  input: ListingProductsInput
): Promise<ListingProductsAnswer> {
  const [ids, definitions] = await Promise.all([
    baseIds(container, input.listed),
    filterDefinitions(container),
  ])
  const rows = await rowsOf(container, ids, input)
  const arranged = arrange(rows, input.query)
  const start = (input.query.page - 1) * LISTING_PAGE_SIZE
  return {
    product_ids: arranged.slice(start, start + LISTING_PAGE_SIZE).map((row) => row.id),
    count: arranged.length,
    page: input.query.page,
    page_size: LISTING_PAGE_SIZE,
    facets: facetsOf(rows, input.query, definitions),
  }
}
