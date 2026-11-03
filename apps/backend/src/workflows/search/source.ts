import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { searchFields } from "../../lib/search/document"
import type { DocumentInput } from "../../modules/search-index/types"
import { textOf } from "../seo/highlight"
import type { HighlightValue } from "../seo/highlight"

/**
 * A product as the search index reads it (adr/0056): its words (title,
 * codes, brand, shown categories, public attribute values, options,
 * variant titles, tags, type, description) and the facts listings filter
 * and sort by (published, channels, categories, collection, brand, choice
 * options, lowest price per region, stock, age). Read through Query, the
 * prices once per region; never a module's service directly.
 */

export const SOURCE_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "status",
  "created_at",
  "collection_id",
  "type.value",
  "tags.value",
  "sales_channels.id",
  "categories.id",
  "categories.name",
  "categories.is_active",
  "categories.is_internal",
  "brand.id",
  "brand.name",
  "brand.handle",
  "attribute_values.value_text",
  "attribute_values.value_number",
  "attribute_values.value_boolean",
  "attribute_values.value_options",
  "attribute_values.definition.key",
  "attribute_values.definition.type",
  "attribute_values.definition.label",
  "attribute_values.definition.unit",
  "attribute_values.definition.options",
  "attribute_values.definition.is_public",
  "variants.title",
  "variants.sku",
  "variants.barcode",
  "variants.ean",
  "variants.upc",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.options.value",
  "variants.variant_extension.mpn",
  "variants.inventory_items.inventory.location_levels.available_quantity",
]

type Maybe<T> = T | null | undefined

interface Variant {
  title?: Maybe<string>
  sku?: Maybe<string>
  barcode?: Maybe<string>
  ean?: Maybe<string>
  upc?: Maybe<string>
  manage_inventory?: Maybe<boolean>
  allow_backorder?: Maybe<boolean>
  options?: Maybe<Maybe<{ value?: Maybe<string> }>[]>
  variant_extension?: Maybe<{ mpn?: Maybe<string> }>
  inventory_items?: Maybe<
    Maybe<{
      inventory?: Maybe<{ location_levels?: Maybe<Maybe<{ available_quantity?: unknown }>[]> }>
    }>[]
  >
}

export interface ProductSource {
  id: string
  title?: Maybe<string>
  subtitle?: Maybe<string>
  description?: Maybe<string>
  status?: Maybe<string>
  created_at: string | Date
  collection_id?: Maybe<string>
  type?: Maybe<{ value?: Maybe<string> }>
  tags?: Maybe<Maybe<{ value?: Maybe<string> }>[]>
  sales_channels?: Maybe<Maybe<{ id: string }>[]>
  categories?: Maybe<
    Maybe<{ id: string; name: string; is_active?: Maybe<boolean>; is_internal?: Maybe<boolean> }>[]
  >
  brand?: Maybe<{ id?: Maybe<string>; name?: Maybe<string>; handle?: Maybe<string> }>
  attribute_values?: Maybe<
    Maybe<HighlightValue & { definition?: Maybe<{ key?: Maybe<string> }> }>[]
  >
  variants?: Maybe<Maybe<Variant>[]>
}

const present = <T>(values: Maybe<Maybe<T>[]>): T[] =>
  (values ?? []).filter((value): value is T => value !== null && value !== undefined)

const texts = (values: readonly Maybe<string>[]): string[] =>
  values.filter((value): value is string => typeof value === "string" && value.trim() !== "")

/** A variant a shopper can have now: no stock kept, sold past stock, or some on a shelf. */
function inStock(variant: Variant): boolean {
  if (variant.manage_inventory === false || variant.allow_backorder === true) {
    return true
  }
  return present(variant.inventory_items).some((item) =>
    present(item.inventory?.location_levels).some(
      (level) => (Number(level.available_quantity) || 0) > 0
    )
  )
}

/** A choice attribute's options as `key=value`: what a listing's filters narrow by. */
function optionsOf(product: ProductSource): string[] {
  const options = new Set<string>()
  for (const value of present(product.attribute_values)) {
    const key = value.definition?.key
    const type = value.definition?.type
    // A single choice keeps its option in `value_text`, a multiple one in `value_options`
    const chosen =
      type === "select"
        ? texts([value.value_text])
        : type === "multi_select" && Array.isArray(value.value_options)
          ? texts(value.value_options as Maybe<string>[])
          : []
    if (!key) {
      continue
    }
    for (const option of chosen) {
      options.add(`${key}=${option}`)
    }
  }
  return [...options]
}

/** The product's row; `prices` by `region_id:currency`. */
export function documentOf(
  product: ProductSource,
  prices: Readonly<Record<string, number>>
): DocumentInput {
  const variants = present(product.variants)
  const categories = present(product.categories)
  const shown = categories.filter(
    (category) => category.is_active === true && category.is_internal !== true
  )
  const brand = product.brand
  const text = searchFields({
    title: product.title ?? "",
    codes: texts(
      variants.flatMap((variant) => [
        variant.sku,
        variant.barcode,
        variant.ean,
        variant.upc,
        variant.variant_extension?.mpn,
      ])
    ),
    brand: brand?.name ?? null,
    categories: shown.map((category) => category.name),
    subtitle: product.subtitle ?? null,
    // A hidden attribute finds nothing (T5)
    attributes: texts(
      present(product.attribute_values)
        .filter((value) => value.definition?.is_public === true)
        .map((value) => textOf(value))
    ),
    options: texts(
      variants.flatMap((variant) => present(variant.options).map((each) => each.value))
    ),
    variants: texts(variants.map((variant) => variant.title)),
    tags: texts(present(product.tags).map((tag) => tag.value)),
    type: product.type?.value ?? null,
    description: product.description ?? null,
  })
  return {
    product_id: product.id,
    published: product.status === "published",
    title: text.title,
    fields: text.fields,
    vocabulary: text.vocabulary,
    sales_channel_ids: present(product.sales_channels).map((channel) => channel.id),
    category_ids: categories.map((category) => category.id),
    categories: shown.map(({ id, name }) => ({ id, name })),
    collection_id: product.collection_id ?? null,
    brand:
      brand?.id && brand.handle
        ? { id: brand.id, handle: brand.handle, name: brand.name ?? "" }
        : null,
    options: optionsOf(product),
    prices: { ...prices },
    in_stock: variants.some(inStock),
    product_created_at: new Date(product.created_at).toISOString(),
  }
}

interface PricedProduct {
  id: string
  variants?: Maybe<Maybe<{ calculated_price?: Maybe<{ calculated_amount?: Maybe<number> }> }>[]>
}

/**
 * Each product's lowest selling price per region, for a shopper with no
 * customer group (what listings filtered and sorted by before).
 */
async function pricesOf(
  container: MedusaContainer,
  ids: string[]
): Promise<Map<string, Record<string, number>>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  const prices = new Map<string, Record<string, number>>()
  // An empty id filter is no filter: every product would be read
  for (const region of ids.length > 0 ? (regions as { id: string; currency_code: string }[]) : []) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "variants.calculated_price.calculated_amount"],
      filters: { id: ids },
      context: {
        variants: {
          calculated_price: QueryContext({
            currency_code: region.currency_code,
            region_id: region.id,
          }),
        },
      },
    })
    for (const product of data as PricedProduct[]) {
      const amounts = present(product.variants).flatMap((variant) => {
        const amount = variant.calculated_price?.calculated_amount
        return typeof amount === "number" ? [amount] : []
      })
      if (amounts.length > 0) {
        const own = prices.get(product.id) ?? {}
        own[`${region.id}:${region.currency_code}`] = Math.min(...amounts)
        prices.set(product.id, own)
      }
    }
  }
  return prices
}

/** The rows of these products; those gone from the catalogue listed apart. */
export async function readSearchDocuments(
  container: MedusaContainer,
  ids: readonly string[]
): Promise<{ documents: DocumentInput[]; gone: string[] }> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) {
    return { documents: [], gone: [] }
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: SOURCE_FIELDS,
    filters: { id: unique },
  })
  const products = data as ProductSource[]
  const prices = await pricesOf(
    container,
    products.map((product) => product.id)
  )
  const found = new Set(products.map((product) => product.id))
  return {
    documents: products.map((product) => documentOf(product, prices.get(product.id) ?? {})),
    gone: unique.filter((id) => !found.has(id)),
  }
}
