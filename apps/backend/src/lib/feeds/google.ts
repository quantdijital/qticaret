import { escapeXml } from "../clients/xml"
import type { FeedFormatter, FeedItem, FeedShop } from "./items"
import { feedPrice, feedText, shippingCost } from "./items"

/**
 * Google Merchant Center's feed (F10.8, docs/13 §10): RSS 2.0 with its
 * `g:` namespace, as its product data specification asks. An item without
 * an image is refused there, and a preorder needs an availability date the
 * catalog does not keep yet: both are left out.
 */

export const GOOGLE_NAMESPACE = "http://base.google.com/ns/1.0"

const AVAILABILITY = {
  InStock: "in_stock",
  OutOfStock: "out_of_stock",
  BackOrder: "backorder",
  PreOrder: "preorder",
} as const

// Google knows no "damaged": a damaged item is sold used
const CONDITION = { new: "new", refurbished: "refurbished", used: "used", damaged: "used" } as const

// Gender and age group take Google's fixed words (male, adult); the shop's own words are not them
const PROPERTIES = ["color", "size", "material", "pattern"] as const

const tag = (name: string, value: string | null | undefined): string =>
  value ? `<g:${name}>${escapeXml(value)}</g:${name}>` : ""

/** Whether the item has the identifiers Google asks for; else `identifier_exists` says no. */
const identified = (item: FeedItem): boolean =>
  item.gtin !== null || (item.brand !== null && item.mpn !== null)

function itemXml(item: FeedItem, shop: FeedShop): string {
  const onSale = item.strikethrough !== null
  const shipping = shippingCost(item, shop)
  return [
    "<item>",
    tag("id", item.id),
    tag("title", feedText(item.title, 150)),
    tag("description", feedText(item.description, 5000)),
    tag("link", item.link),
    tag("image_link", item.imageLink),
    ...item.additionalImages.map((url) => tag("additional_image_link", url)),
    tag("availability", AVAILABILITY[item.availability]),
    // On sale: the price is the one struck through, the sale price the one paid
    tag("price", feedPrice(onSale ? (item.strikethrough ?? item.price) : item.price)),
    onSale ? tag("sale_price", feedPrice(item.price)) : "",
    tag("condition", CONDITION[item.condition]),
    tag("brand", item.brand),
    tag("gtin", item.gtin),
    tag("mpn", item.mpn),
    identified(item) ? "" : tag("identifier_exists", "no"),
    tag("item_group_id", item.groupId),
    tag("product_type", item.categoryPath.join(" > ")),
    ...PROPERTIES.map((property) => tag(property, item.properties[property])),
    shipping === null
      ? ""
      : `<g:shipping><g:country>TR</g:country><g:price>${feedPrice(shipping)}</g:price></g:shipping>`,
    tag("min_handling_time", String(shop.handlingDays.min)),
    tag("max_handling_time", String(shop.handlingDays.max)),
    "</item>",
  ].join("")
}

export const googleFeed: FeedFormatter = {
  target: "google",
  contentType: "application/xml; charset=utf-8",
  extension: "xml",
  // Google refuses an item without an image
  accepts: (item) => item.imageLink !== null && item.availability !== "PreOrder",
  render: (items, shop) =>
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<rss version="2.0" xmlns:g="${GOOGLE_NAMESPACE}"><channel>`,
      `<title>${escapeXml(shop.name)}</title>`,
      `<link>${escapeXml(shop.url)}</link>`,
      `<description>${escapeXml(shop.name)}</description>`,
      ...items.map((item) => itemXml(item, shop)),
      "</channel></rss>",
      "",
    ].join("\n"),
}
