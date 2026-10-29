import { escapeXml } from "../clients/xml"
import type { FeedFormatter, FeedItem, FeedShop } from "./items"
import { feedText, shippingCost } from "./items"

/**
 * Akakçe's feed (F10.8): `<products>` of `<product>`, in the shape the
 * shop's earlier store sent Akakçe and Akakçe took. Prices with a point,
 * shipping price and desi with a comma, as Akakçe reads them. Shipping
 * from the shop's own table or flat rate; delivery days from its handling
 * time; the same-day hour only when the shop promises one (left out
 * otherwise).
 */

/** A stock count Akakçe takes for a variant that keeps none (sold without a count). */
const UNCOUNTED_STOCK = 99

const point = (amount: number): string => amount.toFixed(2)
const comma = (amount: number): string => amount.toFixed(2).replace(".", ",")
const element = (name: string, value: string | null): string =>
  value === null || value === "" ? `<${name}/>` : `<${name}>${escapeXml(value)}</${name}>`

function productXml(item: FeedItem, shop: FeedShop): string {
  const shipping = shippingCost(item, shop)
  return [
    "<product>",
    element("sku", item.sku ?? item.id),
    element("name", feedText(item.title, 150)),
    element("url", item.link),
    element("imgUrl", item.imageLink),
    item.additionalImages.length > 0
      ? `<additionalimages>${item.additionalImages.map((url) => element("imgUrl", url)).join("")}</additionalimages>`
      : "",
    element("description", feedText(item.description, 5000)),
    "<distributor/>",
    element("listPrice", point(item.strikethrough ?? item.price)),
    element("price", point(item.price)),
    element("shipPrice", shipping === null ? null : comma(shipping)),
    element("shipmentVolume", comma(item.desi ?? 1)),
    element("dayOfDelivery", String(shop.handlingDays.max)),
    shop.sameDayCutoffHour === null
      ? ""
      : element("expressDeliveryTime", String(shop.sameDayCutoffHour)),
    element("quantity", String(item.stock ?? UNCOUNTED_STOCK)),
    element("productBrand", item.brand ?? shop.name),
    element("productCategory", item.categoryPath.at(-1) ?? null),
    element("barcode", item.gtin),
    "</product>",
  ].join("")
}

export const akakceFeed: FeedFormatter = {
  target: "akakce",
  contentType: "application/xml; charset=utf-8",
  extension: "xml",
  // A price comparison lists what can be bought now, with its picture
  accepts: (item) => item.imageLink !== null && item.availability === "InStock",
  render: (items, shop) =>
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<products xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      ...items.map((item) => productXml(item, shop)),
      "</products>",
      "",
    ].join("\n"),
}
