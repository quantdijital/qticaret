import { escapeCsvCell } from "../security/csv"
import type { FeedFormatter, FeedItem } from "./items"
import { feedPrice, feedText } from "./items"

/**
 * Meta's catalog feed (F10.8): a CSV with its column names. Availability
 * in its words; on sale, the price is the one struck through and
 * `sale_price` the one paid, as on Google.
 */

const AVAILABILITY = {
  InStock: "in stock",
  OutOfStock: "out of stock",
  BackOrder: "available for order",
  PreOrder: "preorder",
} as const

const CONDITION = { new: "new", refurbished: "refurbished", used: "used", damaged: "used" } as const

const COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "gtin",
  "mpn",
  "item_group_id",
  "product_type",
  "color",
  "size",
] as const

function row(item: FeedItem): string {
  const onSale = item.strikethrough !== null
  const values: Record<(typeof COLUMNS)[number], string | null> = {
    id: item.id,
    title: feedText(item.title, 200),
    description: feedText(item.description, 9999),
    availability: AVAILABILITY[item.availability],
    condition: CONDITION[item.condition],
    price: feedPrice(onSale ? (item.strikethrough ?? item.price) : item.price),
    sale_price: onSale ? feedPrice(item.price) : null,
    link: item.link,
    image_link: item.imageLink,
    additional_image_link: item.additionalImages.join(",") || null,
    brand: item.brand,
    gtin: item.gtin,
    mpn: item.mpn,
    item_group_id: item.groupId,
    product_type: item.categoryPath.join(" > ") || null,
    color: item.properties.color ?? null,
    size: item.properties.size ?? null,
  }
  // The exports' own escape (docs/04): no cell starts a formula, mid-cell after `;` either,
  // whoever opens the file in Excel
  return COLUMNS.map((column) => escapeCsvCell(values[column])).join(",")
}

export const metaFeed: FeedFormatter = {
  target: "meta",
  contentType: "text/csv; charset=utf-8",
  extension: "csv",
  // Meta refuses an item without an image
  accepts: (item) => item.imageLink !== null,
  render: (items) => [COLUMNS.join(","), ...items.map(row), ""].join("\n"),
}
