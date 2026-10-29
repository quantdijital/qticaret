import { escapeXml } from "../clients/xml"
import type { FeedFormatter, FeedItem } from "./items"
import { feedPrice, feedText } from "./items"

/**
 * Cimri's feed (F10.8): RSS 2.0 with Google's `g:` namespace, in the
 * shape the shop's earlier store sent Cimri and Cimri took: the item's
 * id, condition, price, availability ("in stock"), image, brand (the
 * shop's name without one), MPN (the SKU, else the id) and GTIN.
 */

const NAMESPACE = "http://base.google.com/ns/1.0"
const CONDITION = { new: "new", refurbished: "refurbished", used: "used", damaged: "used" } as const

const tag = (name: string, value: string | null | undefined): string =>
  value ? `<g:${name}>${escapeXml(value)}</g:${name}>` : ""

function itemXml(item: FeedItem, shopName: string): string {
  return [
    "<item>",
    `<title>${escapeXml(feedText(item.title, 150))}</title>`,
    `<link>${escapeXml(item.link)}</link>`,
    `<description>${escapeXml(feedText(item.description, 5000))}</description>`,
    tag("id", item.id),
    tag("condition", CONDITION[item.condition]),
    tag("price", feedPrice(item.price)),
    tag("availability", "in stock"),
    tag("image_link", item.imageLink),
    tag("brand", item.brand ?? shopName),
    tag("mpn", item.sku ?? item.id),
    tag("gtin", item.gtin),
    "</item>",
  ].join("")
}

export const cimriFeed: FeedFormatter = {
  target: "cimri",
  contentType: "application/xml; charset=utf-8",
  extension: "xml",
  // A price comparison lists what can be bought now, with its picture
  accepts: (item) => item.imageLink !== null && item.availability === "InStock",
  render: (items, shop) =>
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<rss version="2.0" xmlns:g="${NAMESPACE}"><channel>`,
      `<title>${escapeXml(shop.name)}</title>`,
      `<link>${escapeXml(shop.url)}</link>`,
      `<description>${escapeXml(shop.name)}</description>`,
      ...items.map((item) => itemXml(item, shop.name)),
      "</channel></rss>",
      "",
    ].join("\n"),
}
