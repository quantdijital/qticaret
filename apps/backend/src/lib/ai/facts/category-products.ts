import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What a category page lists (adr/0074 §4): a few of its published
 * products' names, its most frequent brands and how many products it has,
 * as a range. Names only: no price, stock, variant or sales figure is
 * read; a draft or hidden product is never named, nor a closed brand.
 */

/** Product names named at most, newest first. */
export const CATEGORY_PRODUCT_EXAMPLES = 12
/** Brands named at most, the most frequent first. */
export const CATEGORY_TOP_BRANDS = 5
/** Products read to count brands: the newest of the category. */
export const CATEGORY_BRAND_SAMPLE = 100

/** Only names and a link's names: nothing priced, stocked or counted per sale. */
export const CATEGORY_PRODUCT_FIELDS = ["id", "title"] as const
export const CATEGORY_BRAND_FIELDS = ["id", "brand.name", "brand.is_active"] as const

interface BrandRow {
  id: string
  brand?: { name?: string | null; is_active?: boolean | null } | null
}

/** "40+ ürün": a range, never the exact count of a large listing. */
export function productCountLabel(count: number): string | null {
  if (count <= 0) {
    return null
  }
  if (count < 10) {
    return `${String(count)} ürün`
  }
  const steps = [500, 100, 40, 10]
  const floor = steps.find((step) => count >= step) ?? 10
  return `${String(floor)}+ ürün`
}

/** The most frequent names first; a tie keeps the alphabetical order. */
function topBrands(rows: readonly BrandRow[]): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = row.brand?.is_active === false ? null : row.brand?.name?.trim()
    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "tr"))
    .slice(0, CATEGORY_TOP_BRANDS)
    .map(([name]) => name)
}

/** The category's listing as the data block takes it; empty fields for a category with none. */
export async function categoryProductFacts(
  container: FactsContainer,
  categoryId: string
): Promise<RecordFacts> {
  const [rows, count] = await container.resolve(Modules.PRODUCT).listAndCountProducts(
    { categories: { id: [categoryId] }, status: "published" },
    {
      select: [...CATEGORY_PRODUCT_FIELDS],
      take: CATEGORY_BRAND_SAMPLE,
      order: { created_at: "DESC" },
    }
  )
  if (rows.length === 0) {
    return { products: null, brands: null, product_count: null }
  }
  const names = [...new Set(rows.map((row) => row.title.trim()).filter((title) => title !== ""))]
  // Through the product's side of the brand link (links/product-brand.ts)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [...CATEGORY_BRAND_FIELDS],
    filters: { id: rows.map((row) => row.id) },
  })
  const brands = topBrands(data as BrandRow[])
  return {
    products: names.slice(0, CATEGORY_PRODUCT_EXAMPLES).join(", ") || null,
    brands: brands.length > 0 ? brands.join(", ") : null,
    product_count: productCountLabel(count),
  }
}
