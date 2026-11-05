import { feedText, shippingCost } from "../feeds"
import type { FeedItem, FeedShop } from "../feeds"

/**
 * A feed item as Merchant API's `ProductInput` (F10 M13, adr/0038 §3):
 * the same item the Google feed lists, so the API and the feed say the
 * same. Checked against Merchant API's products_v1 reference.
 */

export const CONTENT_LANGUAGE = "tr"
export const FEED_LABEL = "TR"

interface Price {
  amountMicros: string
  currencyCode: "TRY"
}

export interface ProductInput {
  offerId: string
  contentLanguage: string
  feedLabel: string
  productAttributes: Record<string, unknown>
}

const AVAILABILITY = {
  InStock: "IN_STOCK",
  OutOfStock: "OUT_OF_STOCK",
  BackOrder: "BACKORDER",
  PreOrder: "PREORDER",
} as const

const CONDITION = { new: "NEW", refurbished: "REFURBISHED", used: "USED", damaged: "USED" } as const

// Through kuruş: 499.9 lira is 499900000 micros, never 499899999
const price = (amount: number): Price => ({
  amountMicros: String(Math.round(amount * 100) * 10_000),
  currencyCode: "TRY",
})

const compact = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([, each]) =>
        each !== null && each !== undefined && !(Array.isArray(each) && each.length === 0)
    )
  )

export function productInputOf(item: FeedItem, shop: FeedShop): ProductInput {
  const onSale = item.strikethrough !== null
  const shipping = shippingCost(item, shop)
  const identified = item.gtin !== null || (item.brand !== null && item.mpn !== null)
  return {
    offerId: item.id,
    contentLanguage: CONTENT_LANGUAGE,
    feedLabel: FEED_LABEL,
    productAttributes: compact({
      // Cut as the feed file cuts them: at a word
      title: feedText(item.title, 150),
      description: feedText(item.description, 5000),
      link: item.link,
      imageLink: item.imageLink,
      additionalImageLinks: item.additionalImages,
      availability: AVAILABILITY[item.availability],
      condition: CONDITION[item.condition],
      brand: item.brand,
      gtins: item.gtin ? [item.gtin] : null,
      mpn: item.mpn,
      identifierExists: identified ? null : false,
      itemGroupId: item.groupId,
      productTypes: item.categoryPath.length > 0 ? [item.categoryPath.join(" > ")] : null,
      price: price(onSale ? (item.strikethrough ?? item.price) : item.price),
      salePrice: onSale ? price(item.price) : null,
      color: item.properties.color,
      size: item.properties.size,
      material: item.properties.material,
      pattern: item.properties.pattern,
      shipping: shipping === null ? null : [{ country: "TR", price: price(shipping) }],
      minHandlingTime: String(shop.handlingDays.min),
      maxHandlingTime: String(shop.handlingDays.max),
    }),
  }
}

/**
 * A product input's name for delete: its language, label and offer id,
 * base64url-encoded as Google recommends (an id may hold a slash).
 */
export const productInputName = (merchantId: string, offerId: string): string =>
  `accounts/${merchantId}/productInputs/${Buffer.from(
    `${CONTENT_LANGUAGE}~${FEED_LABEL}~${offerId}`
  ).toString("base64url")}`
