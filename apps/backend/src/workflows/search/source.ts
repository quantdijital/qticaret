import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storedSummaryText } from "../../lib/catalog/summary"
import { searchFields } from "../../lib/search/document"
import type { DocumentInput } from "../../modules/search-index/types"
import { textOf } from "../seo/highlight"
import type { HighlightValue } from "../seo/highlight"
import { payingCategoryIds } from "../../lib/booking/categories"
import { indexedPrices } from "./prices"

/**
 * A product as the search index reads it (adr/0056): its words (title,
 * codes, brand, shown categories, public attribute values, options,
 * variant titles, tags, type, short description, description) and the
 * facts listings filter and sort by (published, channels, categories,
 * collection, brand, choice options, prices (prices.ts), stock, on sale,
 * age). Read through Query; never a module's service directly.
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
  // adr/0055 Ek 2026-11-06: the short description, below the title
  "product_extension.summary_doc",
  // adr/0077 §5: a dated product's price is its paying categories' lowest
  "product_extension.booking_mode",
  "bookable.pax_by_variant",
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
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.barcode",
  "variants.ean",
  "variants.upc",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.variant_rank",
  "variants.options.value",
  "variants.variant_extension.mpn",
  "variants.inventory_items.inventory.location_levels.available_quantity",
]

type Maybe<T> = T | null | undefined

interface Variant {
  id?: Maybe<string>
  title?: Maybe<string>
  sku?: Maybe<string>
  barcode?: Maybe<string>
  ean?: Maybe<string>
  upc?: Maybe<string>
  manage_inventory?: Maybe<boolean>
  allow_backorder?: Maybe<boolean>
  variant_rank?: Maybe<number>
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
  product_extension?: Maybe<{ summary_doc?: unknown; booking_mode?: Maybe<string> }>
  bookable?: Maybe<{ pax_by_variant?: unknown }>
}

const present = <T>(values: Maybe<Maybe<T>[]>): T[] =>
  (values ?? []).filter((value): value is T => value !== null && value !== undefined)

/**
 * The variants a product's indexed price is the lowest of: all of them,
 * but a dated product's only its main paying category, the one its card
 * prices (adr/0076 Ek "kart fiyatı ana kategoriden": not an infant who
 * takes no place, nor a cheaper child, adr/0077 §5). The card prices a
 * date search's departures; a seasonal difference between the two is a
 * known limit (adr/0077 §5).
 */
export function pricedVariantIds(product: ProductSource): string[] {
  if (product.product_extension?.booking_mode !== "departure") {
    return present(product.variants).flatMap((variant) => (variant.id ? [variant.id] : []))
  }
  const rows = present(product.variants).flatMap((variant) =>
    variant.id ? [{ id: variant.id, variant_rank: variant.variant_rank ?? null }] : []
  )
  return payingCategoryIds(rows, product.bookable?.pax_by_variant).slice(0, 1)
}

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

/** The product's row; `prices` by `region_id:currency`; `onSale`: shown as a discount now. */
export function documentOf(
  product: ProductSource,
  prices: Readonly<Record<string, number>>,
  onSale = false
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
    summary: storedSummaryText(product.product_extension?.summary_doc),
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
    // A draft is listed nowhere: its prices are not worked out
    on_sale: onSale && product.status === "published",
    product_created_at: new Date(product.created_at).toISOString(),
  }
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
  const priced = await indexedPrices(
    container,
    products.map((product) => ({
      id: product.id,
      published: product.status === "published",
      variant_ids: pricedVariantIds(product),
    }))
  )
  const found = new Set(products.map((product) => product.id))
  return {
    documents: products.map((product) => {
      const own = priced.get(product.id)
      return documentOf(product, own?.prices ?? {}, own?.on_sale ?? false)
    }),
    gone: unique.filter((id) => !found.has(id)),
  }
}
