import type { Availability, Condition, ProductFacts, VariesBy } from "../seo/jsonld"

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
  /** Gross TRY the shop charges to ship one; null when its table does not say. */
  shippingRate: number | null
}

/**
 * The feed items of a product: each variant with an offer on the page (a
 * price above zero) that is not out of stock.
 */
export function feedItemsOf(facts: ProductFacts, url: string): FeedItem[] {
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
}

/** One target's file (adr/0038 §3): a new target is a new formatter. */
export interface FeedFormatter {
  target: string
  contentType: string
  extension: string
  /** Whether the target lists the item at all. */
  accepts: (item: FeedItem) => boolean
  render: (items: readonly FeedItem[], shop: FeedShop) => string
}
