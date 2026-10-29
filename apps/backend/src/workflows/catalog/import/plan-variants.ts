import type { SheetProblem, SheetProduct, SheetVariant } from "../../../lib/catalog-sheet"
import { fromMedusaAmount } from "../../../lib/money"
import { CURRENCY, baseTryOf, nextPrices } from "../prices"
import type { ExistingProduct, ExistingVariant, ImportReferences } from "./references"

/**
 * A sheet product's variants as the import writes them (F3.9). A new
 * product gets its options from the rows (or the panel's single
 * `Seçenek: Standart`). For one that exists, a row finds its variant by
 * SKU, else by its option values, else (no options, one variant) the one
 * there is; a row that finds none is a new variant, with values the
 * product's options already have (new values are added in the panel).
 * Prices: the TRY price is replaced, the others kept, as the panel does.
 * Unit costs (F11.4) go through the catalog save once the variants exist.
 */

// What the panel's wizard gives a product without options (Medusa needs one)
export const DEFAULT_OPTION = { title: "Seçenek", value: "Standart" } as const

export interface StockLine {
  /** Null for a variant this import makes: found by `key` once it exists. */
  variantId: string | null
  key: string
  quantity: number
}

/** A unit cost in lira, as the catalog save takes it; a new variant found by `key`. */
export interface CostLine {
  variantId: string | null
  key: string
  cost: number
}

export interface VariantsPlan {
  /** A new product's options; null for one that exists. */
  options: { title: string; values: string[] }[] | null
  /** A new product's variants, or the variants added to one. */
  variantCreates: Record<string, unknown>[]
  variantUpdates: Record<string, unknown>[]
  stock: StockLine[]
  costs: CostLine[]
}

/** The variant's option values as one key, whatever their order or case. */
export const optionKey = (options: Record<string, string>): string =>
  JSON.stringify(
    Object.entries(options)
      .map(([title, value]) => [title.toLocaleLowerCase("tr"), value.toLocaleLowerCase("tr")])
      .sort(([a = ""], [b = ""]) => a.localeCompare(b))
  )

// What a row changes of a variant: only what differs from what it has
function variantChanges(variant: SheetVariant, match: ExistingVariant) {
  const base = baseTryOf(match.prices)
  return {
    ...(variant.sku && variant.sku !== match.sku ? { sku: variant.sku } : {}),
    ...(variant.barcode && variant.barcode !== match.ean ? { ean: variant.barcode } : {}),
    ...(variant.price !== undefined && variant.price !== base?.amount
      ? { prices: nextPrices(match.prices, variant.price) }
      : {}),
  }
}

// A row that says nothing of a variant (an export's product without one)
const isEmptyRow = (variant: SheetVariant) =>
  variant.options.length === 0 &&
  !variant.sku &&
  !variant.barcode &&
  variant.price === undefined &&
  variant.cost === undefined &&
  variant.stock === undefined

const codes = (variant: SheetVariant) => ({
  ...(variant.sku ? { sku: variant.sku } : {}),
  ...(variant.barcode ? { ean: variant.barcode } : {}),
})

// A row found by its SKU whose option values are another variant's
const optionsDiffer = (variant: SheetVariant, match: ExistingVariant) =>
  variant.options.length > 0 &&
  optionKey(Object.fromEntries(variant.options)) !== optionKey(match.options)

function newProduct(sheet: SheetProduct): VariantsPlan {
  const names = (sheet.variants[0]?.options ?? []).map(([name]) => name)
  // The first row's option names, whatever case the other rows write them in
  const optionsOf = (variant: SheetVariant): Record<string, string> =>
    names.length > 0
      ? Object.fromEntries(names.map((name, index) => [name, variant.options[index]?.[1] ?? ""]))
      : { [DEFAULT_OPTION.title]: DEFAULT_OPTION.value }
  const options =
    names.length > 0
      ? names.map((name, index) => ({
          title: name,
          values: [...new Set(sheet.variants.map((variant) => variant.options[index]?.[1] ?? ""))],
        }))
      : [{ title: DEFAULT_OPTION.title, values: [DEFAULT_OPTION.value] }]
  return {
    options,
    variantCreates: sheet.variants.map((variant, index) => ({
      title:
        names.length > 0
          ? variant.options.map(([, value]) => value).join(" / ")
          : sheet.fields.title,
      variant_rank: index,
      ...codes(variant),
      manage_inventory: true,
      prices:
        variant.price === undefined ? [] : [{ currency_code: CURRENCY, amount: variant.price }],
      options: optionsOf(variant),
    })),
    variantUpdates: [],
    stock: stockLines(sheet.variants, () => null, optionsOf),
    costs: costLines(sheet.variants, () => null, optionsOf),
  }
}

function stockLines(
  variants: readonly SheetVariant[],
  idOf: (variant: SheetVariant) => string | null,
  optionsOf: (variant: SheetVariant) => Record<string, string>
): StockLine[] {
  return variants.flatMap((variant) =>
    variant.stock === undefined
      ? []
      : [{ variantId: idOf(variant), key: optionKey(optionsOf(variant)), quantity: variant.stock }]
  )
}

function costLines(
  variants: readonly SheetVariant[],
  idOf: (variant: SheetVariant) => string | null,
  optionsOf: (variant: SheetVariant) => Record<string, string>
): CostLine[] {
  return variants.flatMap((variant) =>
    variant.cost === undefined
      ? []
      : [{ variantId: idOf(variant), key: optionKey(optionsOf(variant)), cost: variant.cost }]
  )
}

function matchOf(product: ExistingProduct, variant: SheetVariant): ExistingVariant | undefined {
  const sku = variant.sku?.toLowerCase()
  const bySku = sku ? product.variants.find((each) => each.sku?.toLowerCase() === sku) : undefined
  if (bySku) {
    return bySku
  }
  if (variant.options.length === 0) {
    return product.variants.length === 1 ? product.variants[0] : undefined
  }
  const wanted = optionKey(Object.fromEntries(variant.options))
  return product.variants.find((each) => optionKey(each.options) === wanted)
}

// A new variant of a product that exists: every option of the product, each with a value it has
function addedOptions(product: ExistingProduct, variant: SheetVariant, problems: SheetProblem[]) {
  const given = new Map(
    variant.options.map(([name, value]) => [name.toLocaleLowerCase("tr"), value])
  )
  if (given.size !== product.options.length) {
    problems.push({ line: variant.line, key: "catalog_import.variant_unmatched" })
    return null
  }
  const options: Record<string, string> = {}
  for (const option of product.options) {
    const value = given.get(option.title.toLocaleLowerCase("tr"))
    if (value === undefined) {
      problems.push({ line: variant.line, key: "catalog_import.option_unknown" })
      return null
    }
    const known = option.values.find(
      (each) => each.toLocaleLowerCase("tr") === value.toLocaleLowerCase("tr")
    )
    if (known === undefined) {
      problems.push({ line: variant.line, key: "catalog_import.option_value_unknown" })
      return null
    }
    options[option.title] = known
  }
  return options
}

// A row that found its variant: what changes, its stock; problems when it is found twice or disagrees
function matchedRow(
  plan: VariantsPlan,
  variant: SheetVariant,
  match: ExistingVariant,
  context: { found: Set<string>; locationId: string | null },
  problems: SheetProblem[]
) {
  const { found, locationId } = context
  if (found.has(match.id)) {
    problems.push({ line: variant.line, key: "catalog_import.variant_matched_twice" })
    return
  }
  found.add(match.id)
  if (optionsDiffer(variant, match)) {
    problems.push({ line: variant.line, key: "catalog_import.options_mismatch" })
    return
  }
  if (variant.stock !== undefined && !match.inventoryItemId) {
    problems.push({ line: variant.line, key: "catalog_import.stock_untracked", column: "Stok" })
    return
  }
  const changes = variantChanges(variant, match)
  if (Object.keys(changes).length > 0) {
    plan.variantUpdates.push({ id: match.id, ...changes })
  }
  // The quantity the default warehouse has already is no change
  if (
    variant.stock !== undefined &&
    (locationId === null || match.levels[locationId] !== variant.stock)
  ) {
    plan.stock.push(
      ...stockLines(
        [variant],
        () => match.id,
        () => match.options
      )
    )
  }
  // The cost it has already is no change
  if (variant.cost !== undefined && fromMedusaAmount(variant.cost) !== match.cost) {
    plan.costs.push(
      ...costLines(
        [variant],
        () => match.id,
        () => match.options
      )
    )
  }
}

function existingProduct(
  sheet: SheetProduct,
  product: ExistingProduct,
  locationId: string | null,
  problems: SheetProblem[]
): VariantsPlan {
  const plan: VariantsPlan = {
    options: null,
    variantCreates: [],
    variantUpdates: [],
    stock: [],
    costs: [],
  }
  const context = { found: new Set<string>(), locationId }
  for (const variant of sheet.variants) {
    if (isEmptyRow(variant)) {
      continue
    }
    const match = matchOf(product, variant)
    if (match) {
      matchedRow(plan, variant, match, context, problems)
      continue
    }
    const options = addedOptions(product, variant, problems)
    if (options) {
      plan.variantCreates.push({
        product_id: product.id,
        title: Object.values(options).join(" / "),
        ...codes(variant),
        manage_inventory: true,
        prices:
          variant.price === undefined ? [] : [{ currency_code: CURRENCY, amount: variant.price }],
        options,
      })
      plan.stock.push(
        ...stockLines(
          [variant],
          () => null,
          () => options
        )
      )
      plan.costs.push(
        ...costLines(
          [variant],
          () => null,
          () => options
        )
      )
    }
  }
  return plan
}

export function variantsPlan(
  sheet: SheetProduct,
  existing: ExistingProduct | undefined,
  refs: ImportReferences,
  problems: SheetProblem[]
): VariantsPlan {
  const plan = existing
    ? existingProduct(sheet, existing, refs.shop.locationId, problems)
    : newProduct(sheet)
  if (plan.stock.length > 0 && !refs.shop.locationId) {
    problems.push({ line: sheet.line, key: "catalog_import.no_location", column: "Stok" })
  }
  return plan
}
