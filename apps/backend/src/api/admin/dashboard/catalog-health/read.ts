import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DIMENSION_FIELDS, missingDimensions } from "../../../../lib/catalog"
import type { Dimensions } from "../../../../lib/catalog"

// Products read at most (docs/04); past this the counts cover the first ones
const MAX_READ = 2000

// docs/14 P-CONT-01: a description of at least 150 words (the advisor's default)
export const MIN_DESCRIPTION_WORDS = 150

type ProductRow = Dimensions & {
  id: string
  status: string
  description?: string | null
  thumbnail?: string | null
  images?: ({ id: string } | null)[] | null
  categories?: ({ id: string } | null)[] | null
  variants?: (Dimensions | null)[] | null
  product_extension?: { kind?: string | null } | null
}

const words = (text: string | null | undefined): number =>
  (text ?? "").trim().split(/\s+/).filter(Boolean).length

const hasImage = (row: ProductRow) => !!row.thumbnail || (row.images ?? []).some(Boolean)
const hasCategory = (row: ProductRow) => (row.categories ?? []).some(Boolean)

// Published physical products a carrier cannot price (the F3.1 publish rule)
function lacksDimensions(row: ProductRow): boolean {
  if (row.status !== "published" || (row.product_extension?.kind ?? "physical") !== "physical") {
    return false
  }
  const variants = (row.variants ?? []).filter((variant): variant is Dimensions => variant !== null)
  return (variants.length ? variants : [{}]).some(
    (variant) => missingDimensions(row, variant).length > 0
  )
}

/**
 * How complete the catalog is (docs/14 rules a shop meets first): images,
 * categories, descriptions, and weight and dimensions for shipping. Counts
 * only; the SEO advisor (F3 T11) scores each product in depth.
 */
export async function readCatalogHealth(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "status",
      "description",
      "thumbnail",
      "images.id",
      "categories.id",
      ...DIMENSION_FIELDS,
      ...DIMENSION_FIELDS.map((field) => `variants.${field}`),
      "product_extension.kind",
    ],
    pagination: { skip: 0, take: MAX_READ },
  })
  const rows = data as ProductRow[]
  const checks = {
    without_image: rows.filter((row) => !hasImage(row)),
    without_category: rows.filter((row) => !hasCategory(row)),
    short_description: rows.filter((row) => words(row.description) < MIN_DESCRIPTION_WORDS),
    missing_dimensions: rows.filter(lacksDimensions),
  }
  const flagged = new Set(Object.values(checks).flatMap((list) => list.map((row) => row.id)))
  return {
    products: metadata?.count ?? rows.length,
    complete: rows.length - flagged.size,
    without_image: checks.without_image.length,
    without_category: checks.without_category.length,
    short_description: checks.short_description.length,
    missing_dimensions: checks.missing_dimensions.length,
    min_description_words: MIN_DESCRIPTION_WORDS,
    capped: (metadata?.count ?? 0) > rows.length,
  }
}

export type CatalogHealth = Awaited<ReturnType<typeof readCatalogHealth>>
