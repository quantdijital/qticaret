import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, QueryContext } from "@medusajs/framework/utils"
import { createTtlCache } from "../../lib/cache"
import { chunksOf } from "../../lib/catalog"
import { LISTING_PAGE_SIZE, LISTING_PARAMS } from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { baseOf } from "./listing"
import type { Listed } from "./listing"
import { arrange, facetsOf } from "./listing-facets"
import type { ListingFacets, ListingRow } from "./listing-facets"
import { SEARCH_FIELDS, SEARCH_LISTING, searchDocOf, searchListingRows } from "./listing-search"
import type { ListingSearch, SearchedProduct } from "./listing-search"

/**
 * A listing page's products for the storefront (F18 D4, docs/13 §7): the
 * listing's published products in the shopper's sales channels, narrowed
 * by its filters and price range, in its sort, one page of ids; and the
 * filters it can offer with how many products each would show. Worked
 * out in memory over the listing's products: a few thousand at most per
 * listing until search (D10) takes the large ones. A site search
 * (`search`, its id the query as compared) is the whole catalogue's rows
 * the query finds, most relevant first (listing-search.ts).
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
  /** A site search's suggestions and related chips. */
  search?: ListingSearch
}

interface ProductRow extends SearchedProduct {
  created_at: string | Date
  sales_channels?: ({ id: string } | null)[] | null
  brand?: { id?: string; handle: string; name: string } | null
  attribute_values?:
    | ({
        value_text?: string | null
        value_options?: string[] | null
        definition?: { key: string; type: string; is_public?: boolean | null } | null
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

/**
 * What filtering and sorting read of each product: brand, options, lowest
 * price, age; with `withText`, what search reads too (the whole catalogue's).
 */
async function rowsOf(
  container: MedusaContainer,
  ids: string[],
  input: ListingProductsInput,
  withText: boolean
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
        ...(withText ? SEARCH_FIELDS : []),
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
        ...(withText ? { doc: searchDocOf(product) } : {}),
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

/**
 * A listing's rows and the filter definitions, shared for 30 seconds by
 * every page, filter and sort of it (security review 2026-11-02): a shopper
 * paging and filtering, or anyone sending a new query each time, costs one
 * catalogue read per listing and region, not one per request. A price or
 * product change shows within that time, as resolve's answers do.
 */
const listingRows = createTtlCache<ListingRow[]>({ ttlMs: 30_000, maxEntries: 200 })
const definitionsCache = createTtlCache<Awaited<ReturnType<typeof filterDefinitions>>>({
  ttlMs: 30_000,
  maxEntries: 1,
})

const rowsKey = (input: ListingProductsInput) =>
  [
    input.listed.entity_type,
    input.listed.entity_id,
    input.region_id ?? "",
    input.currency_code,
    [...input.sales_channel_ids].sort().join(","),
  ].join("|")

export async function listingProducts(
  container: MedusaContainer,
  input: ListingProductsInput
): Promise<ListingProductsAnswer> {
  const started = performance.now()
  const isSearch = input.listed.entity_type === SEARCH_LISTING
  // A search reads the whole catalogue's rows, shared with `/magaza`
  const listed = isSearch ? { entity_type: ALL_PRODUCTS, entity_id: ALL_PRODUCTS } : input.listed
  const [rows, definitions] = await Promise.all([
    listingRows(rowsKey({ ...input, listed }), async () =>
      rowsOf(
        container,
        await baseIds(container, listed),
        input,
        listed.entity_type === ALL_PRODUCTS
      )
    ),
    definitionsCache("definitions", () => filterDefinitions(container)),
  ])
  const searched = isSearch ? await searchListingRows(rows, input.listed.entity_id) : null
  const shown = searched?.rows ?? rows
  // No sort chosen: a search's own order is relevance
  const arranged = arrange(shown, input.query)
  const start = (input.query.page - 1) * LISTING_PAGE_SIZE
  const answer: ListingProductsAnswer = {
    product_ids: arranged.slice(start, start + LISTING_PAGE_SIZE).map((row) => row.id),
    count: arranged.length,
    page: input.query.page,
    page_size: LISTING_PAGE_SIZE,
    facets: facetsOf(shown, input.query, definitions),
  }
  if (searched) {
    answer.search = {
      suggestions: searched.suggestions,
      related: searched.related,
      took_ms: Math.round(performance.now() - started),
    }
  }
  return answer
}
