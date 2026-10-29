import { OPTION_KEYS, SHEET_COLUMNS, attributeHeader, headerOf } from "../../../lib/catalog-sheet"
import type { ColumnKey, SheetUnits } from "../../../lib/catalog-sheet"
import type { SheetCell } from "../../../lib/sheets"
import { DEFAULT_OPTION } from "../import/plan-variants"
import { CURRENCY } from "../prices"

/**
 * A product as the sheet's rows (F3.9): one per variant, the product's
 * own fields on its first row, its handle on every row. What an import
 * reads back. A product with the panel's single `Seçenek: Standart` has
 * no option columns.
 */

export const EXPORT_FIELDS = [
  "id",
  "handle",
  "title",
  "status",
  "description",
  "weight",
  "length",
  "width",
  "height",
  "categories.handle",
  "categories.id",
  "collection.handle",
  "brand.handle",
  "seo_meta.seo_title",
  "seo_meta.seo_description",
  "seo_meta.focus_keyword",
  "attribute_template.handle",
  "attribute_values.value_text",
  "attribute_values.value_number",
  "attribute_values.value_boolean",
  "attribute_values.value_options",
  "attribute_values.definition.key",
  "attribute_values.definition.type",
  "product_extension.primary_category_id",
  "options.id",
  "options.title",
  "options.values.value",
  "variants.sku",
  "variants.ean",
  "variants.variant_rank",
  "variants.options.value",
  "variants.options.option_id",
  "variants.prices.currency_code",
  "variants.prices.amount",
  "variants.prices.price_list_id",
  "variants.prices.rules_count",
  "variants.prices.min_quantity",
  "variants.prices.max_quantity",
  "variants.inventory_items.inventory.location_levels.location_id",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "variants.variant_extension.cost",
]

interface AttributeValueRow {
  value_text?: string | null
  value_number?: number | string | null
  value_boolean?: boolean | null
  value_options?: unknown
  definition?: { key: string; type: string } | null
}

interface VariantRow {
  sku?: string | null
  ean?: string | null
  variant_rank?: number | null
  options?: { value: string; option_id: string }[] | null
  prices?:
    | {
        currency_code: string
        amount: number | string
        price_list_id?: string | null
        rules_count?: number | null
        min_quantity?: number | string | null
        max_quantity?: number | string | null
      }[]
    | null
  inventory_items?:
    | {
        inventory?: {
          location_levels?: { location_id: string; stocked_quantity: number | string }[] | null
        } | null
      }[]
    | null
  /** The unit cost in kuruş (F11.4). */
  variant_extension?: { cost?: number | null } | null
}

export interface ExportProductRow {
  handle: string
  title: string
  status: string
  description?: string | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  categories?: ({ id: string; handle: string } | null)[] | null
  collection?: { handle: string } | null
  brand?: { handle: string } | null
  seo_meta?: {
    seo_title?: string | null
    seo_description?: string | null
    focus_keyword?: string | null
  } | null
  attribute_template?: { handle: string } | null
  attribute_values?: (AttributeValueRow | null)[] | null
  product_extension?: { primary_category_id?: string | null } | null
  options?: { id: string; title: string; values?: { value: string }[] | null }[] | null
  variants?: (VariantRow | null)[] | null
}

/** The header the template and the export write: the columns, then the attributes. */
export function sheetHeader(units: SheetUnits, attributeKeys: readonly string[]): string[] {
  return [
    ...SHEET_COLUMNS.map((column) => headerOf(column, units)),
    ...attributeKeys.map(attributeHeader),
  ]
}

export const sheetWidths = (attributeKeys: readonly string[]): number[] => [
  ...SHEET_COLUMNS.map((column) => column.width),
  ...attributeKeys.map(() => 18),
]

function attributeCell(value: AttributeValueRow): SheetCell {
  const type = value.definition?.type ?? "text"
  if (type === "number") {
    return value.value_number === null || value.value_number === undefined
      ? null
      : Number(value.value_number)
  }
  if (type === "boolean") {
    return typeof value.value_boolean === "boolean"
      ? value.value_boolean
        ? "Evet"
        : "Hayır"
      : null
  }
  if (type === "multi_select") {
    return Array.isArray(value.value_options) ? (value.value_options as string[]).join("|") : null
  }
  return value.value_text ?? null
}

// Primary first, as an import makes the first the primary one
function categoriesCell(product: ExportProductRow): string | null {
  const primary = product.product_extension?.primary_category_id
  const categories = (product.categories ?? []).flatMap((each) => (each ? [each] : []))
  categories.sort((a, b) => Number(b.id === primary) - Number(a.id === primary))
  return categories.length > 0 ? categories.map((each) => each.handle).join("|") : null
}

function productCells(product: ExportProductRow): Partial<Record<ColumnKey, SheetCell>> {
  return {
    title: product.title,
    status: product.status === "published" ? "Yayında" : "Taslak",
    // An empty description is no text to write
    description: product.description?.trim() === "" ? null : (product.description ?? null),
    categories: categoriesCell(product),
    collection: product.collection?.handle ?? null,
    brand: product.brand?.handle ?? null,
    weight: product.weight ?? null,
    length: product.length ?? null,
    width: product.width ?? null,
    height: product.height ?? null,
    seo_title: product.seo_meta?.seo_title ?? null,
    seo_description: product.seo_meta?.seo_description ?? null,
    focus_keyword: product.seo_meta?.focus_keyword ?? null,
    template: product.attribute_template?.handle ?? null,
  }
}

const isDefaultOption = (product: ExportProductRow): boolean => {
  const [only, ...rest] = product.options ?? []
  return (
    rest.length === 0 &&
    only?.title === DEFAULT_OPTION.title &&
    (only.values ?? []).every((value) => value.value === DEFAULT_OPTION.value)
  )
}

function variantCells(product: ExportProductRow, variant: VariantRow, locationId: string | null) {
  const cells: Partial<Record<ColumnKey, SheetCell>> = {}
  if (!isDefaultOption(product)) {
    const values = new Map((variant.options ?? []).map((value) => [value.option_id, value.value]))
    OPTION_KEYS.forEach(([nameKey, valueKey], index) => {
      const option = product.options?.[index]
      if (option) {
        cells[nameKey] = option.title
        cells[valueKey] = values.get(option.id) ?? null
      }
    })
  }
  // The plain TRY price: not a price list's, no rules, no quantity bounds (what the import replaces)
  const price = variant.prices?.find(
    (each) =>
      each.currency_code === CURRENCY &&
      !each.price_list_id &&
      !each.rules_count &&
      (each.min_quantity ?? null) === null &&
      (each.max_quantity ?? null) === null
  )
  const level = variant.inventory_items?.[0]?.inventory?.location_levels?.find(
    (each) => each.location_id === locationId
  )
  return {
    ...cells,
    sku: variant.sku ?? null,
    // The sheet's barcode is the variant's EAN: what an import writes back
    barcode: variant.ean ?? null,
    price: price ? Number(price.amount) : null,
    cost: costInLira(variant.variant_extension?.cost ?? null),
    stock: level ? Number(level.stocked_quantity) : null,
  }
}

// The sheet writes lira, as the import reads it back
const costInLira = (kurus: number | null) => (kurus === null ? null : kurus / 100)

/** The product's rows, its variants in their order. */
export function productRows(
  product: ExportProductRow,
  attributeKeys: readonly string[],
  locationId: string | null
): SheetCell[][] {
  const variants = (product.variants ?? [])
    .flatMap((variant) => (variant ? [variant] : []))
    .sort((a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0))
  const own = productCells(product)
  const attributes = new Map(
    (product.attribute_values ?? []).flatMap((value) =>
      value?.definition ? [[value.definition.key, attributeCell(value)]] : []
    )
  )
  return (variants.length > 0 ? variants : [{}]).map((variant, index) => {
    const cells = {
      handle: product.handle,
      ...(index === 0 ? own : {}),
      ...variantCells(product, variant, locationId),
    }
    return [
      ...SHEET_COLUMNS.map((column) => cells[column.key] ?? null),
      ...attributeKeys.map((key) => (index === 0 ? (attributes.get(key) ?? null) : null)),
    ]
  })
}
