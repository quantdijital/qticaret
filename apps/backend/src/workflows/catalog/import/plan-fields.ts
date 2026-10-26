import { missingDimensions } from "../../../lib/catalog"
import type { SheetProblem, SheetProduct } from "../../../lib/catalog-sheet"
import type { CurrentFields } from "./existing-products"

/**
 * A sheet product's own fields as the import writes them (F3.9): what the
 * row fills, and for a product that exists only what differs from what it
 * has, so a sheet exported and uploaded again writes nothing.
 */

export interface Found {
  categories: string[] | undefined
  collection: string | undefined
  brand: string | undefined
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

// The fields Medusa takes as they are, by what the product has now
function differs(key: string, value: unknown, current: CurrentFields): boolean {
  const now = (current as unknown as Record<string, unknown>)[key]
  if (typeof value === "number") {
    return now === null || now === undefined || Number(now) !== value
  }
  return (now ?? "") !== value
}

/** The product's fields Medusa takes; for one that exists, those that change. */
export function productFields(
  sheet: SheetProduct,
  found: Found,
  current: CurrentFields | undefined
): Record<string, unknown> {
  const { fields } = sheet
  const scalar = Object.entries({
    title: fields.title,
    description: fields.description,
    status: fields.status,
    collection_id: found.collection,
    weight: fields.weight,
    length: fields.length,
    width: fields.width,
    height: fields.height,
  }).filter(([key, value]) => value !== undefined && (!current || differs(key, value, current)))
  const categories =
    found.categories && (!current || !sameIds(found.categories, current.categoryIds))
      ? { categories: found.categories.map((id) => ({ id })) }
      : {}
  return { ...Object.fromEntries(scalar), ...categories }
}

/** The SEO fields the row fills that the product does not have already. */
export function seoFields(sheet: SheetProduct, current: CurrentFields | undefined) {
  const { seo_title, seo_description, focus_keyword } = sheet.fields
  const seo = Object.fromEntries(
    Object.entries({ seo_title, seo_description, focus_keyword }).filter(
      ([key, value]) => value && value !== current?.seo[key as keyof CurrentFields["seo"]]
    )
  )
  return Object.keys(seo).length > 0 ? seo : null
}

/**
 * The brand, and the primary category: the first category named, for a
 * new product or one whose categories the row changes (a product that
 * keeps its categories keeps its primary one, or its lack of one).
 */
export function linksOf(found: Found, current: CurrentFields | undefined) {
  const recategorized =
    !current || (found.categories !== undefined && !sameIds(found.categories, current.categoryIds))
  const primary = recategorized ? found.categories?.[0] : undefined
  return {
    ...(found.brand && found.brand !== current?.brandId ? { brandId: found.brand } : {}),
    ...(primary && primary !== current?.primaryCategoryId ? { primaryCategoryId: primary } : {}),
  }
}

/**
 * A new product going live needs its weight and measurements (F3.1): the
 * product hook would refuse it on apply, so the check says so first.
 */
export function publishProblems(sheet: SheetProduct, isNew: boolean): SheetProblem[] {
  if (!isNew || sheet.fields.status !== "published") {
    return []
  }
  return missingDimensions(sheet.fields).length > 0
    ? [{ line: sheet.line, key: "catalog.dimensions_required" }]
    : []
}
