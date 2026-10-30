import type { Availability, Condition, ProductFacts, VariesBy } from "../seo/jsonld"
import type { FeedTarget } from "./targets"

/**
 * One variant as every feed lists it (F10.8, adr/0038 §3), read from the
 * same facts the page's JSON-LD is built from (docs/13 §10): its price,
 * stock, codes and address are those the page shows.
 */
export interface FeedItem {
  /** The variant's id: the same item across runs. */
  id: string
  /** The product's handle when it has several variants (Google's `item_group_id`). */
  groupId: string | null
  title: string
  description: string
  /** The page, with the variant preselected as the JSON-LD offer's URL is. */
  link: string
  imageLink: string | null
  additionalImages: string[]
  /** Gross TRY the shopper pays now: the JSON-LD offer's price. */
  price: number
  /** The price shown struck through beside it, when the 30-day rule allows one. */
  strikethrough: number | null
  availability: Availability
  condition: Condition
  brand: string | null
  gtin: string | null
  mpn: string | null
  properties: Partial<Record<VariesBy, string>>
  /** Gross TRY the shop's desi table charges to ship one; null when it does not say. */
  shippingRate: number | null
  /** The variant's own code; null when it has none. */
  sku: string | null
  /** Units available; null when the variant keeps no stock count. */
  stock: number | null
  /** One unit's parcel in desi; null without its measures. */
  desi: number | null
  /** The primary category's path, top first: "Mutfak > Bıçaklar". */
  categoryPath: string[]
  /** Every category the product is in, with their parents: what a feed's exclusions match. */
  categoryIds: string[]
}

/** Where the product sits in the catalog, for feeds that name it and for exclusions. */
export interface FeedPlace {
  path: string[]
  ids: string[]
}

/**
 * The feed items of a product: each variant with an offer on the page (a
 * price above zero) that is not out of stock. A product sold to adults
 * only stays out (adr/0041 §4): feeds have rules of their own for it.
 */
export function feedItemsOf(
  facts: ProductFacts,
  url: string,
  place: FeedPlace = { path: [], ids: [] }
): FeedItem[] {
  if (facts.adultConsideration) {
    return []
  }
  const single = facts.variants.length === 1
  return facts.variants.flatMap((variant) => {
    if (variant.price === null || !(variant.price > 0) || variant.availability === "OutOfStock") {
      return []
    }
    const image = variant.image ?? facts.images[0] ?? null
    return [
      {
        id: variant.id,
        groupId: single ? null : facts.groupId,
        title: single ? facts.name : variant.name,
        description: facts.description || facts.name,
        link: single ? url : `${url}?variant=${encodeURIComponent(variant.id)}`,
        imageLink: image,
        additionalImages: facts.images.filter((each) => each !== image).slice(0, 10),
        price: variant.price,
        strikethrough:
          variant.strikethrough && variant.strikethrough > variant.price
            ? variant.strikethrough
            : null,
        availability: variant.availability,
        condition: facts.condition,
        brand: facts.brand,
        gtin: variant.gtin,
        mpn: variant.mpn,
        properties: variant.properties,
        shippingRate: typeof variant.shippingRate === "number" ? variant.shippingRate : null,
        sku: variant.sku,
        stock: typeof variant.stock === "number" ? variant.stock : null,
        desi: typeof variant.desi === "number" ? variant.desi : null,
        categoryPath: place.path,
        categoryIds: place.ids,
      },
    ]
  })
}

/** A lira amount as feeds write it: `1234.50 TRY`. */
export const feedPrice = (amount: number): string => `${amount.toFixed(2)} TRY`

/** A feed's text: plain, one line of spaces, at most `max` characters. */
export function feedText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export interface FeedShop {
  name: string
  /** The storefront's address. */
  url: string
  /** Working days to get an order out of the door (Settings > Shipping). */
  handlingDays: { min: number; max: number }
  /** The cheapest flat-rate delivery shoppers can pick, gross TRY; null: none. */
  flatShipping: number | null
  /** Flat-rate shipping is free from this basket total (Settings > Promotions); null: never. */
  freeShippingFrom: number | null
  /** An order placed before this hour leaves the same day (Akakçe); null: not promised. */
  sameDayCutoffHour: number | null
}

/**
 * What shipping one unit costs a shopper: the shop's desi table when it
 * prices the item, else its cheapest flat rate, free past the basket
 * total the shop set; null when neither says.
 */
export function shippingCost(item: FeedItem, shop: FeedShop): number | null {
  if (item.shippingRate !== null) {
    return item.shippingRate
  }
  if (shop.flatShipping === null) {
    return null
  }
  return shop.freeShippingFrom !== null && item.price >= shop.freeShippingFrom
    ? 0
    : shop.flatShipping
}

/** Whether the item is in a category the shop keeps out of a feed. */
export const excludedBy = (item: FeedItem, categoryIds: readonly string[]): boolean =>
  categoryIds.some((id) => item.categoryIds.includes(id))

/** One target's file (adr/0038 §3): a new target is a new formatter. */
export interface FeedFormatter {
  target: FeedTarget
  contentType: string
  extension: string
  /** Whether the target lists the item at all. */
  accepts: (item: FeedItem) => boolean
  render: (items: readonly FeedItem[], shop: FeedShop) => string
}
