import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deepestCategory } from "../../lib/catalog"
import { feedItemsOf } from "../../lib/feeds"
import type { FeedItem, FeedPlace, FeedShop } from "../../lib/feeds"
import { storedSummaryText } from "../../lib/catalog/summary"
import { standaloneThreshold } from "../../lib/promotions/free-shipping"
import { productText } from "../../lib/seo/product-text"
import { sameDayCutoffHour } from "../../lib/shipping/same-day"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type {
  MarketingSettings,
  PromotionSettings,
  ShippingSettings,
} from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { priceDisplays } from "../pricing/price-display"
import { PRODUCT_FACT_FIELDS, productFacts } from "../seo/facts"
import type { FactRow } from "../seo/facts"
import { shippingFactsOf } from "../seo/payload"
import { markedCategories } from "../catalog/restrictions"
import { shopShippingOptions } from "../shipping/shop-options"

/** Products read at a time. */
const PAGE = 200

interface CategoryRow {
  id: string
  name: string
  mpath?: string | null
}

interface FeedProductRow extends Omit<FactRow, "product_extension"> {
  id: string
  description?: string | null
  brand?: { name: string } | null
  categories?: (CategoryRow | null)[] | null
  product_extension?:
    | (NonNullable<FactRow["product_extension"]> & {
        primary_category_id?: string | null
        summary_doc?: unknown
      })
    | null
}

const chainOf = (row: CategoryRow): string[] => (row.mpath ?? row.id).split(".").filter(Boolean)

/**
 * Where a product sits: its primary category's path by name (else its
 * deepest one's, as its page files it), and every category it is in with
 * their parents, which a feed's exclusions match.
 */
function placeOf(row: FeedProductRow, names: ReadonlyMap<string, string>): FeedPlace {
  const categories = (row.categories ?? []).filter((each): each is CategoryRow => each !== null)
  const chosen = row.product_extension?.primary_category_id
  const primary =
    categories.find((each) => each.id === chosen) ?? deepestCategory(categories) ?? null
  return {
    path: primary
      ? chainOf(primary).flatMap((id) => {
          const name = names.get(id)
          return name ? [name] : []
        })
      : [],
    ids: [...new Set(categories.flatMap(chainOf))],
  }
}

/**
 * A product sold by date (adr/0076 §10): no feed item. A shopping feed
 * lists goods that ship at one price; a departure's price and places are
 * the page's, and the product cannot go in a cart without one.
 */
export const isDated = (row: Pick<FactRow, "product_extension">): boolean =>
  (row.product_extension?.booking_mode ?? "none") !== "none"

/**
 * Every published product with a storefront address, as feed items: the
 * same facts, prices (the 30-day rule's too) and shipping rates the page's
 * JSON-LD is built from (docs/13 §10), with where it sits in the catalog.
 * A dated product is left out (`isDated`).
 */
export async function catalogItems(
  container: MedusaContainer,
  storefront: string
): Promise<FeedItem[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const urls = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const [shipping, { data: categoryRows }, restricted] = await Promise.all([
    shippingFactsOf(container),
    query.graph({ entity: "product_category", fields: ["id", "name"] }),
    markedCategories(container),
  ])
  const names = new Map((categoryRows as CategoryRow[]).map((row) => [row.id, row.name]))
  const items: FeedItem[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "description",
        "brand.name",
        "categories.id",
        "categories.mpath",
        "product_extension.primary_category_id",
        "product_extension.summary_doc",
        ...PRODUCT_FACT_FIELDS,
      ],
      filters: { status: "published" },
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    const rows = data as FeedProductRow[]
    const entries = await urls.listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: CATALOG_ENTITY_TYPES.product,
        entity_id: rows.map((row) => row.id),
        status: "active",
      },
      { select: ["entity_id", "path"], take: rows.length }
    )
    const paths = new Map(entries.map((entry) => [entry.entity_id, entry.path]))
    const displays = await priceDisplays(
      container,
      rows.flatMap((row) =>
        (row.variants ?? []).flatMap((variant) => (variant ? [variant.id] : []))
      ),
      "try"
    )
    for (const row of rows) {
      const path = paths.get(row.id)
      if (path && !isDated(row)) {
        const facts = productFacts(
          row,
          row.brand?.name ?? null,
          // adr/0055 Ek 2026-11-06: without a description, the short description's text
          productText(row.description ?? "", storedSummaryText(row.product_extension?.summary_doc)),
          displays,
          shipping,
          undefined,
          restricted
        )
        // A product sold to adults only has no item (adr/0041 §4)
        items.push(...feedItemsOf(facts, `${storefront}${path}`, placeOf(row, names)))
      }
    }
    if (rows.length < PAGE) {
      return items
    }
  }
}

/**
 * What every feed says of the shop beside its products: its name and
 * address, its handling days, the cheapest flat rate a shopper can pick
 * for delivery (not collection) and the basket total that makes it free,
 * and the same-day hour it promises; with each feed's exclusions.
 */
export async function feedShopOf(
  container: MedusaContainer,
  brand: { shopName: string; storefrontUrl: string }
): Promise<{ shop: FeedShop; exclusions: MarketingSettings["feed_exclusions"] }> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [shipping, promotions, marketing, options] = await Promise.all([
    settings.getSection("shipping") as Promise<unknown> as Promise<ShippingSettings>,
    settings.getSection("promotions") as Promise<unknown> as Promise<PromotionSettings>,
    settings.getSection("marketing") as Promise<unknown> as Promise<MarketingSettings>,
    shopShippingOptions(container),
  ])
  const flat = options.flatMap((option) =>
    option.pricing === "flat" &&
    option.in_store &&
    option.carrier !== "pickup" &&
    option.amount !== null
      ? [Number(option.amount)]
      : []
  )
  return {
    shop: {
      name: brand.shopName,
      url: brand.storefrontUrl,
      handlingDays: { min: shipping.handling_days_min, max: shipping.handling_days_max },
      flatShipping: flat.length > 0 ? Math.min(...flat) : null,
      freeShippingFrom: standaloneThreshold(promotions),
      // Kargo's hour, else the one set under the feed rules before it moved
      sameDayCutoffHour: sameDayCutoffHour(shipping, marketing),
    },
    exclusions: marketing.feed_exclusions,
  }
}
