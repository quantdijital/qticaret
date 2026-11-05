import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../../lib/catalog"
import { storedSummaryText } from "../../../lib/catalog/summary"
import { PRICE_FIELDS, pricesOf } from "../prices"
import type { ExistingPrice, PriceRow } from "../prices"

export type { ExistingPrice } from "../prices"

/**
 * The products a sheet names that exist, as the import needs them (F3.9):
 * their options, variants and stock items, the values a row would change
 * (so an unchanged field is not written again) and their prices. A
 * variant's base TRY price is the one with no price list, no rules and no
 * quantity bounds: the one the sheet's `Fiyat` is; price-list prices are
 * not the price set's to replace and are left out.
 */

// Products read with their variants per query
const PRODUCT_CHUNK = 200

export interface ExistingVariant {
  id: string
  sku: string | null
  ean: string | null
  /** Option title (lower case) → value. */
  options: Record<string, string>
  prices: ExistingPrice[]
  inventoryItemId: string | null
  /** Stocked quantity by location. */
  levels: Record<string, number>
  /** Unit cost in kuruş (F11.4); null when none was entered. */
  cost: number | null
}

export interface CurrentFields {
  title: string
  description: string | null
  /** The short description's plain text as the export writes it; "" for none. */
  summary: string
  status: string
  collection_id: string | null
  weight: number | null
  length: number | null
  width: number | null
  height: number | null
  categoryIds: string[]
  brandId: string | null
  primaryCategoryId: string | null
  seo: { seo_title: string | null; seo_description: string | null; focus_keyword: string | null }
  /** F3.2: a digital or service product has no parcel to measure. */
  physical: boolean
  /** Its product type: its KDV rate's (adr/0007); null on the default. */
  typeId: string | null
}

export interface ExistingProduct {
  id: string
  handle: string
  options: { id: string; title: string; values: string[] }[]
  variants: ExistingVariant[]
  templateHandle: string | null
  current: CurrentFields
  /** Attribute key → its value as the template takes it. */
  attributes: Record<string, unknown>
}

interface ProductRow extends Omit<
  CurrentFields,
  "categoryIds" | "brandId" | "primaryCategoryId" | "seo" | "physical" | "typeId" | "summary"
> {
  id: string
  handle: string
  type_id?: string | null
  categories?: ({ id: string } | null)[] | null
  brand?: { id: string } | null
  product_extension?: {
    primary_category_id?: string | null
    kind?: string | null
    summary_doc?: unknown
  } | null
  seo_meta?: Partial<CurrentFields["seo"]> | null
  options?: { id: string; title: string; values?: { value: string }[] | null }[] | null
  variants?:
    | {
        id: string
        sku: string | null
        ean: string | null
        options?: { value: string; option_id: string }[] | null
        prices?: PriceRow[] | null
        variant_extension?: { cost?: number | null } | null
        inventory_items?:
          | {
              inventory_item_id: string
              inventory?: {
                location_levels?:
                  { location_id: string; stocked_quantity: number | string }[] | null
              } | null
            }[]
          | null
      }[]
    | null
  attribute_template?: { handle: string } | null
  attribute_values?: (AttributeValueRow | null)[] | null
}

interface AttributeValueRow {
  value_text?: string | null
  value_number?: number | string | null
  value_boolean?: boolean | null
  value_options?: unknown
  definition?: { key: string; type: string } | null
}

const FIELDS = [
  "id",
  "handle",
  "title",
  "description",
  "status",
  "collection_id",
  "type_id",
  "weight",
  "length",
  "width",
  "height",
  "categories.id",
  "brand.id",
  "product_extension.primary_category_id",
  "product_extension.kind",
  "product_extension.summary_doc",
  "seo_meta.seo_title",
  "seo_meta.seo_description",
  "seo_meta.focus_keyword",
  "options.id",
  "options.title",
  "options.values.value",
  "variants.id",
  "variants.sku",
  "variants.ean",
  "variants.options.value",
  "variants.options.option_id",
  ...PRICE_FIELDS,
  "variants.inventory_items.inventory_item_id",
  "variants.inventory_items.inventory.location_levels.location_id",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "variants.variant_extension.cost",
  "attribute_template.handle",
  "attribute_values.value_text",
  "attribute_values.value_number",
  "attribute_values.value_boolean",
  "attribute_values.value_options",
  "attribute_values.definition.key",
  "attribute_values.definition.type",
]

// A stored value as the template takes it, to compare with a row's
function attributeValue(value: AttributeValueRow): unknown {
  const type = value.definition?.type ?? "text"
  if (type === "number") {
    return value.value_number === null || value.value_number === undefined
      ? null
      : Number(value.value_number)
  }
  if (type === "boolean") {
    return value.value_boolean ?? null
  }
  return type === "multi_select" ? (value.value_options ?? null) : (value.value_text ?? null)
}

function currentOf(row: ProductRow): CurrentFields {
  return {
    title: row.title,
    description: row.description,
    summary: storedSummaryText(row.product_extension?.summary_doc),
    status: row.status,
    collection_id: row.collection_id,
    weight: row.weight,
    length: row.length,
    width: row.width,
    height: row.height,
    categoryIds: (row.categories ?? []).flatMap((category) => (category ? [category.id] : [])),
    brandId: row.brand?.id ?? null,
    primaryCategoryId: row.product_extension?.primary_category_id ?? null,
    seo: {
      seo_title: row.seo_meta?.seo_title ?? null,
      seo_description: row.seo_meta?.seo_description ?? null,
      focus_keyword: row.seo_meta?.focus_keyword ?? null,
    },
    physical: (row.product_extension?.kind ?? "physical") === "physical",
    typeId: row.type_id ?? null,
  }
}

function existingOf(row: ProductRow): ExistingProduct {
  const options = (row.options ?? []).map((option) => ({
    id: option.id,
    title: option.title,
    values: (option.values ?? []).map((value) => value.value),
  }))
  const titleOf = new Map(
    options.map((option) => [option.id, option.title.toLocaleLowerCase("tr")])
  )
  return {
    id: row.id,
    handle: row.handle,
    options,
    templateHandle: row.attribute_template?.handle ?? null,
    current: currentOf(row),
    attributes: Object.fromEntries(
      (row.attribute_values ?? []).flatMap((value) =>
        value?.definition ? [[value.definition.key, attributeValue(value)]] : []
      )
    ),
    variants: (row.variants ?? []).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      ean: variant.ean,
      options: Object.fromEntries(
        (variant.options ?? []).map((value) => [titleOf.get(value.option_id) ?? "", value.value])
      ),
      prices: pricesOf(variant.prices),
      // A kit's several items are not one stock a sheet can set
      inventoryItemId:
        variant.inventory_items?.length === 1
          ? (variant.inventory_items[0]?.inventory_item_id ?? null)
          : null,
      levels: Object.fromEntries(
        (variant.inventory_items?.[0]?.inventory?.location_levels ?? []).map((level) => [
          level.location_id,
          Number(level.stocked_quantity),
        ])
      ),
      cost: variant.variant_extension?.cost ?? null,
    })),
  }
}

/** The products with these handles that exist, by handle. */
export async function existingProducts(container: MedusaContainer, handles: string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const products = new Map<string, ExistingProduct>()
  for (const chunk of chunksOf(handles, PRODUCT_CHUNK)) {
    const { data } = await query.graph({
      entity: "product",
      fields: FIELDS,
      filters: { handle: chunk },
    })
    for (const row of data as ProductRow[]) {
      products.set(row.handle, existingOf(row))
    }
  }
  return products
}
