import {
  attributeHeader,
  attributeValueOf,
  vatRateOf,
  vatTypeChange,
} from "../../../lib/catalog-sheet"
import type { SheetProblem, SheetProduct, SheetVariant } from "../../../lib/catalog-sheet"
import type { AttributeInputValue } from "../../../modules/product-attributes/validation"
import type { ExistingProduct, ExistingVariant, ImportReferences } from "./references"
import { lacksMeasures, linksOf, productFields, seoFields } from "./plan-fields"
import { variantsPlan } from "./plan-variants"
import type { VariantsPlan } from "./plan-variants"

/**
 * One sheet product as the import will write it (F3.9), or the problems
 * that keep it out: names that are not the shop's, a title's handle that
 * is taken, attributes the template does not have. Pure over what
 * `importReferences` read; the workflows check again as they write.
 */

export interface ImportPlan extends VariantsPlan {
  handle: string
  line: number
  /** The product it changes; null for a new one. */
  productId: string | null
  /** A new product's fields, or the changed fields of one. */
  product: Record<string, unknown>
  /** Undefined leaves the brand as it is. */
  brandId?: string
  /** The first category the row names (F3.1); undefined leaves it. */
  primaryCategoryId?: string
  seo: { seo_title?: string; seo_description?: string; focus_keyword?: string } | null
  attributes: { template_id: string; values: Record<string, AttributeInputValue> } | null
  /** Left without weight or measures (adr/0054): a note in the report, never a refusal. */
  noMeasures?: boolean
}

const COLUMNS = {
  categories: "Kategoriler",
  collection: "Koleksiyon",
  brand: "Marka",
  template: "Özellik şablonu",
  vat: "KDV",
} as const

type Problems = SheetProblem[]

function references(
  sheet: SheetProduct,
  refs: ImportReferences,
  problems: Problems,
  current: ExistingProduct["current"] | undefined
) {
  const { fields, line } = sheet
  const unknown = (key: string, column: string) => problems.push({ line, key, column })
  const categories = fields.categories?.map((handle) => refs.categories.get(handle)?.id)
  if (categories?.includes(undefined)) {
    unknown("catalog_import.category_unknown", COLUMNS.categories)
  }
  const collection = fields.collection ? refs.collections.get(fields.collection)?.id : undefined
  if (fields.collection && !collection) {
    unknown("catalog_import.collection_unknown", COLUMNS.collection)
  }
  const brand = fields.brand ? refs.brands.get(fields.brand)?.id : undefined
  if (fields.brand && !brand) {
    unknown("catalog_import.brand_unknown", COLUMNS.brand)
  }
  // The rate's product type (adr/0007); a product taxed at it already stays as it is
  const vat = fields.vat ? vatRateOf(fields.vat, refs.vatRates) : null
  if (vat && !vat.ok) {
    unknown(vat.key, COLUMNS.vat)
  }
  return {
    categories: categories as string[] | undefined,
    collection,
    brand,
    vatTypeId: vat?.ok
      ? vatTypeChange(vat.rate, refs.vatRates, current?.typeId ?? null)
      : undefined,
  }
}

function attributesPlan(
  sheet: SheetProduct,
  existing: ExistingProduct | undefined,
  refs: ImportReferences,
  problems: Problems
): ImportPlan["attributes"] {
  const handle = sheet.fields.template ?? existing?.templateHandle ?? null
  const keys = Object.keys(sheet.attributes)
  if (
    existing?.templateHandle &&
    sheet.fields.template &&
    sheet.fields.template !== existing.templateHandle
  ) {
    problems.push({
      line: sheet.line,
      key: "catalog_import.template_change",
      column: COLUMNS.template,
    })
    return null
  }
  if (!handle) {
    if (keys.length > 0) {
      problems.push({ line: sheet.line, key: "catalog_import.template_required" })
    }
    return null
  }
  const template = refs.templates.get(handle)
  if (!template) {
    problems.push({
      line: sheet.line,
      key: "catalog_import.template_unknown",
      column: COLUMNS.template,
    })
    return null
  }
  const definitions = new Map(
    template.definitions.filter((each) => each.scope === "product").map((each) => [each.key, each])
  )
  const values: Record<string, AttributeInputValue> = {}
  for (const key of keys) {
    const definition = definitions.get(key)
    const cell = definition ? attributeValueOf(definition, sheet.attributes[key] ?? "") : null
    if (!cell?.ok) {
      const problem = cell ? cell.key : "catalog_import.attribute_unknown"
      problems.push({ line: sheet.line, key: problem, column: attributeHeader(key) })
    } else {
      values[key] = cell.value
    }
  }
  const missing = [...definitions.values()].some(
    (each) => each.is_required && !existing && values[each.key] === undefined
  )
  if (missing) {
    problems.push({ line: sheet.line, key: "catalog_import.attribute_required" })
  }
  // A product's values the row repeats are no change; nor is its own template named again
  const changed = Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(existing?.attributes[key] ?? null)
    )
  )
  const isNewTemplate =
    Boolean(sheet.fields.template) && sheet.fields.template !== existing?.templateHandle
  return Object.keys(changed).length > 0 || isNewTemplate
    ? { template_id: template.id, values: changed }
    : null
}

function skuProblems(
  variants: readonly SheetVariant[],
  handle: string,
  refs: ImportReferences,
  problems: Problems
) {
  for (const variant of variants) {
    const holder = variant.sku ? refs.skus.get(variant.sku.toLowerCase()) : undefined
    if (holder && holder !== handle) {
      problems.push({ line: variant.line, key: "catalog_import.sku_taken", column: "SKU" })
    }
  }
}

/** The product's plan, or null with its problems. */
export function planImport(
  sheet: SheetProduct,
  refs: ImportReferences
): { plan: ImportPlan | null; problems: SheetProblem[] } {
  const problems: Problems = []
  const existing = refs.products.get(sheet.handle)
  if (existing && sheet.isDerived) {
    problems.push({ line: sheet.line, key: "catalog_import.handle_exists" })
    return { plan: null, problems }
  }
  if (!existing && !sheet.fields.title) {
    problems.push({ line: sheet.line, key: "catalog_import.title_required" })
  }
  const found = references(sheet, refs, problems, existing?.current)
  const attributes = attributesPlan(sheet, existing, refs, problems)
  skuProblems(sheet.variants, sheet.handle, refs, problems)
  const variants = variantsPlan(sheet, existing, refs, problems)
  if (problems.length > 0) {
    return { plan: null, problems }
  }
  return {
    plan: {
      handle: sheet.handle,
      line: sheet.line,
      productId: existing?.id ?? null,
      product: {
        ...productFields(sheet, found, existing?.current),
        ...(existing ? {} : newProductDefaults(sheet, refs)),
      },
      ...linksOf(found, existing?.current),
      seo: seoFields(sheet, existing?.current),
      attributes,
      ...variants,
      noMeasures: lacksMeasures(sheet, existing?.current),
    },
    problems,
  }
}

// A new product sells in the default channel and ships with the default profile
function newProductDefaults(sheet: SheetProduct, refs: ImportReferences) {
  return {
    handle: sheet.handle,
    status: sheet.fields.status ?? "draft",
    ...(refs.shop.shippingProfileId ? { shipping_profile_id: refs.shop.shippingProfileId } : {}),
    ...(refs.shop.salesChannelId ? { sales_channels: [{ id: refs.shop.salesChannelId }] } : {}),
  }
}

export type { ExistingVariant }
