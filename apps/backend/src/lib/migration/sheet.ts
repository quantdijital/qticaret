import { OPTION_COUNT, OPTION_KEYS, SHEET_COLUMNS, headerOf } from "../catalog-sheet/columns"
import type { ColumnKey, SheetUnits } from "../catalog-sheet/columns"
import type { SheetCell } from "../sheets"
import type { PackageDefaults, SourceProduct, SourceVariant } from "./types"

/**
 * Source products as the catalog sheet (F3.9) reads them (adr/0042 §2):
 * one row per variant, the product's own cells on its first. The sheet's
 * import then checks them (a dry run) or writes them, by handle, so a
 * product met again is updated, not made twice. Categories and brands are
 * named by the handles the migration gave them before.
 */

export interface SheetRefs {
  units: SheetUnits
  /** A category path ("Mutfak > Tavalar") to its handle. */
  categoryHandle: (path: string[]) => string | null
  /** A brand's name to its handle. */
  brandHandle: (name: string) => string | null
  /** The owner's parcel for a product without measurements; none: such a product comes as a draft. */
  defaults: PackageDefaults | null
}

export interface ProductPackage {
  /** Grams and cm, or null where neither the source nor the defaults give one. */
  weight: number | null
  length: number | null
  width: number | null
  height: number | null
  /** Some of it from the owner's defaults. */
  defaulted: boolean
  /** Whether the product may go live with it (F3.1). */
  complete: boolean
}

const positive = (value: number | null | undefined): number | null =>
  typeof value === "number" && value > 0 ? value : null

/**
 * What a product weighs and measures here: the source's own where it has
 * them, else the owner's defaults. The sheet weighs a product, not each
 * variant: the first variant's weight stands for it.
 */
export function packageOf(
  product: SourceProduct,
  defaults: PackageDefaults | null
): ProductPackage {
  const own = {
    weight: positive(product.variants[0]?.weight),
    length: positive(product.dimensions?.length),
    width: positive(product.dimensions?.width),
    height: positive(product.dimensions?.height),
  }
  const merged = {
    weight: own.weight ?? positive(defaults?.weight),
    length: own.length ?? positive(defaults?.length),
    width: own.width ?? positive(defaults?.width),
    height: own.height ?? positive(defaults?.height),
  }
  const fields = ["weight", "length", "width", "height"] as const
  return {
    ...merged,
    defaulted: fields.some((field) => own[field] === null && merged[field] !== null),
    complete: fields.every((field) => merged[field] !== null),
  }
}

/** A product the source shows live, here a draft: nothing to send it in yet. */
export const goesLiveAsDraft = (product: SourceProduct, pack: ProductPackage) =>
  product.status === "published" && !pack.complete

export const categoryKey = (path: readonly string[]) => path.join(" > ")

/** The sheet's header in the shop's units, as the import reads it. */
export const migrationSheetHeader = (units: SheetUnits): string[] =>
  SHEET_COLUMNS.map((column) => headerOf(column, units))

const amount = (text: string | null): number | null => {
  if (text === null) {
    return null
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Grams in the shop's weight unit. */
const weightIn = (grams: number | null, unit: SheetUnits["weight"]): number | null =>
  grams === null ? null : unit === "kg" ? grams / 1000 : grams

function productCells(
  product: SourceProduct,
  refs: SheetRefs
): Partial<Record<ColumnKey, SheetCell>> {
  const categories = product.categories
    .map((path) => refs.categoryHandle(path))
    .filter((handle): handle is string => handle !== null)
  const pack = packageOf(product, refs.defaults)
  const inUnit = (cm: number | null) =>
    cm === null ? null : refs.units.dimension === "mm" ? cm * 10 : cm
  return {
    title: product.title,
    status:
      product.status === "published" && !goesLiveAsDraft(product, pack) ? "Yayında" : "Taslak",
    description: product.description,
    categories: categories.length > 0 ? categories.join("|") : null,
    brand: product.brand ? refs.brandHandle(product.brand) : null,
    seo_title: product.seo_title,
    seo_description: product.seo_description,
    weight: weightIn(pack.weight, refs.units.weight),
    length: inUnit(pack.length),
    width: inUnit(pack.width),
    height: inUnit(pack.height),
  }
}

function variantCells(
  product: SourceProduct,
  variant: SourceVariant
): Partial<Record<ColumnKey, SheetCell>> {
  const cells: Partial<Record<ColumnKey, SheetCell>> = {
    sku: variant.sku,
    barcode: variant.barcode,
    price: amount(variant.price),
    stock: variant.stock,
  }
  product.options.slice(0, OPTION_COUNT).forEach((option, index) => {
    const keys = OPTION_KEYS[index]
    if (keys) {
      cells[keys[0]] = option.name
      cells[keys[1]] = variant.options[option.name] ?? null
    }
  })
  return cells
}

/** A product's rows, its variants in the source's order. */
export function migrationRows(product: SourceProduct, refs: SheetRefs): SheetCell[][] {
  const own = productCells(product, refs)
  const variants: (SourceVariant | null)[] = product.variants.length > 0 ? product.variants : [null]
  return variants.map((variant, index) => {
    const cells: Partial<Record<ColumnKey, SheetCell>> = {
      handle: product.handle,
      ...(index === 0 ? own : {}),
      ...(variant ? variantCells(product, variant) : {}),
    }
    return SHEET_COLUMNS.map((column) => cells[column.key] ?? null)
  })
}
