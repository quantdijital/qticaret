import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { storefrontChannelIds } from "./storefront-channels"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What a category page lists (adr/0074 §4): a few of its published
 * products' names, its most frequent brands and how many products it has,
 * as a range. Names only: no price, stock, variant or sales figure is
 * read; a draft or hidden product is never named, nor a closed brand,
 * nor a product outside the storefront's sales channels (#247 D2: the
 * channels of its publishable keys; none found, nothing is named).
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
/**
 * Which sales channels a product is in: the link's ids only (as
 * `api/store/reviews/visible.ts` reads it), never the channel's data.
 */
export const CATEGORY_CHANNEL_FIELD = "sales_channels.id"

interface ListedRow {
  id: string
  brand?: { name?: string | null; is_active?: boolean | null } | null
  sales_channels?: ({ id?: string | null } | null)[] | null
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
function topBrands(rows: readonly ListedRow[]): string[] {
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

/** The products in at least one of the storefront's sales channels. */
const shownRows = (rows: readonly ListedRow[], channels: ReadonlySet<string>): ListedRow[] =>
  rows.filter((row) =>
    (row.sales_channels ?? []).some(
      (channel) => typeof channel?.id === "string" && channels.has(channel.id)
    )
  )

/**
 * How many the storefront lists: exact when the sample is the whole
 * category, else the category's count in the sample's proportion (only
 * shown as a range, `productCountLabel`).
 */
const shownCount = (count: number, sampled: number, shown: number): number =>
  sampled >= count ? shown : Math.floor((count * shown) / Math.max(1, sampled))

const NONE: RecordFacts = { products: null, brands: null, product_count: null }

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
    return NONE
  }
  // The safe side: no storefront channel found, no product named
  const channels = await storefrontChannelIds(container)
  if (channels.size === 0) {
    return NONE
  }
  // Through the product's side of the brand and sales channel links (links/product-brand.ts)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [...CATEGORY_BRAND_FIELDS, CATEGORY_CHANNEL_FIELD],
    filters: { id: rows.map((row) => row.id) },
  })
  const listed = shownRows(data, channels)
  const shown = new Set(listed.map((row) => row.id))
  if (shown.size === 0) {
    return NONE
  }
  // Newest first, as listed: the query's own order is not the listing's
  const names = [
    ...new Set(
      rows
        .filter((row) => shown.has(row.id))
        .map((row) => row.title.trim())
        .filter((title) => title !== "")
    ),
  ]
  const brands = topBrands(listed)
  return {
    products: names.slice(0, CATEGORY_PRODUCT_EXAMPLES).join(", ") || null,
    brands: brands.length > 0 ? brands.join(", ") : null,
    product_count: productCountLabel(shownCount(count, rows.length, shown.size)),
  }
}
