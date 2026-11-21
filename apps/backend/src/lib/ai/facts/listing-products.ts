import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PLACED_CATEGORY_FIELDS, shownCategoryIds } from "./category-tree"
import type { PlacedCategory } from "./category-tree"
import { storefrontChannelIds } from "./storefront-channels"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What a listing page lists (adr/0074 §4): a category's, a collection's
 * or a brand's published products, as a few names, the most frequent
 * brands (a category, a collection) or categories (a brand), and how many
 * there are, as a range. Names only: no price, stock, variant or sales
 * figure is read; a draft or hidden product is never named, nor a closed
 * brand, nor an internal or closed category, nor a product outside the
 * storefront's sales channels (#247 D2: the channels of its publishable
 * keys; none found, nothing is named).
 */

/** Product names named at most, newest first. */
export const LISTING_PRODUCT_EXAMPLES = 12
/** Brands or categories named at most, the most frequent first. */
export const LISTING_TOP_NAMES = 5
/** Products read to count brands and categories: the newest of the listing. */
export const LISTING_SAMPLE = 100

/** Only names and a link's names: nothing priced, stocked or counted per sale. */
export const LISTING_PRODUCT_FIELDS = ["id", "title"] as const
export const LISTING_BRAND_FIELDS = ["id", "brand.name", "brand.is_active"] as const
export const LISTING_CATEGORY_FIELDS = ["id", ...PLACED_CATEGORY_FIELDS] as const
/**
 * Which sales channels a product is in: the link's ids only (as
 * `api/store/reviews/visible.ts` reads it), never the channel's data.
 */
export const LISTING_CHANNEL_FIELD = "sales_channels.id"

/** What a listing names beside its products: its brands, or (a brand's page) its categories. */
export type ListingTally = "brands" | "categories"

/** The products of a listing, as the product module filters them. */
export type ListingSelector =
  { categories: { id: string[] } } | { collection_id: string } | { id: string[] }

interface NamedRow {
  name?: string | null
  is_active?: boolean | null
  is_internal?: boolean | null
}

interface ListedRow {
  id: string
  brand?: NamedRow | null
  categories?: (PlacedCategory | null)[] | null
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

// A brand shoppers see: not closed; a category: neither internal nor closed
function shownName(row: NamedRow | null | undefined, internalToo: boolean): string | null {
  if (!row || row.is_active === false || (internalToo && row.is_internal === true)) {
    return null
  }
  const name = row.name?.trim() ?? ""
  return name === "" ? null : name
}

// A category is named only when it and every ancestor are shown (`shownCategoryIds`, #250 D1)
const namesOf = (row: ListedRow, tally: ListingTally, shownIds: ReadonlySet<string>): string[] =>
  tally === "brands"
    ? [shownName(row.brand, false)].filter((name): name is string => name !== null)
    : [
        ...new Set(
          (row.categories ?? []).map((category) =>
            typeof category?.id === "string" && shownIds.has(category.id)
              ? shownName(category, true)
              : null
          )
        ),
      ].filter((name): name is string => name !== null)

/** The most frequent names first; a tie keeps the alphabetical order. */
function topNames(
  rows: readonly ListedRow[],
  tally: ListingTally,
  shownIds: ReadonlySet<string>
): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const name of namesOf(row, tally, shownIds)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "tr"))
    .slice(0, LISTING_TOP_NAMES)
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
 * listing, else the listing's count in the sample's proportion (only
 * shown as a range, `productCountLabel`).
 */
const shownCount = (count: number, sampled: number, shown: number): number =>
  sampled >= count ? shown : Math.floor((count * shown) / Math.max(1, sampled))

const noneOf = (tally: ListingTally): RecordFacts => ({
  products: null,
  [tally]: null,
  product_count: null,
})

/** A listing's products as the data block takes them; empty fields for a listing with none. */
export async function listingProductFacts(
  container: FactsContainer,
  selector: ListingSelector,
  tally: ListingTally
): Promise<RecordFacts> {
  const [rows, count] = await container
    .resolve(Modules.PRODUCT)
    .listAndCountProducts(
      { ...selector, status: "published" },
      { select: [...LISTING_PRODUCT_FIELDS], take: LISTING_SAMPLE, order: { created_at: "DESC" } }
    )
  if (rows.length === 0) {
    return noneOf(tally)
  }
  // The safe side: no storefront channel found, no product named
  const channels = await storefrontChannelIds(container)
  if (channels.size === 0) {
    return noneOf(tally)
  }
  // Through the product's side of the brand, category and sales channel links
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      ...(tally === "brands" ? LISTING_BRAND_FIELDS : LISTING_CATEGORY_FIELDS),
      LISTING_CHANNEL_FIELD,
    ],
    filters: { id: rows.map((row) => row.id) },
  })
  const listed = shownRows(data, channels)
  const shown = new Set(listed.map((row) => row.id))
  if (shown.size === 0) {
    return noneOf(tally)
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
  const shownIds =
    tally === "categories"
      ? await shownCategoryIds(
          container,
          listed.flatMap((row) => row.categories ?? [])
        )
      : new Set<string>()
  const top = topNames(listed, tally, shownIds)
  return {
    products: names.slice(0, LISTING_PRODUCT_EXAMPLES).join(", ") || null,
    [tally]: top.length > 0 ? top.join(", ") : null,
    product_count: productCountLabel(shownCount(count, rows.length, shown.size)),
  }
}
