import type { FakeShopifyData, FakeShopifyNode } from "./fake-server"

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const field = (node: FakeShopifyNode, name: string): string => {
  const value = node[name]
  return typeof value === "string" ? value : ""
}

/** A variant's line in the feed: its fields in a feed's order, the empty ones left off. */
function feedItem(origin: string, product: FakeShopifyNode, variant: FakeShopifyNode): string {
  const children = product.children ?? []
  const picture = children
    .map((child) => (child["image"] as { url?: string } | undefined)?.url)
    .find(Boolean)
  const category = children.find((child) => child.id.includes("/Collection/"))
  const option = (product["options"] as { name: string }[] | undefined)?.[0]?.name ?? ""
  const [choice] = (variant["selectedOptions"] as { value: string }[] | undefined) ?? []
  const named = choice && choice.value !== "Default Title" ? choice.value : null
  const before = variant["compareAtPrice"]
  const grams = (
    variant["inventoryItem"] as { measurement?: { weight?: { value?: number } } } | undefined
  )?.measurement?.weight?.value
  const fields: [string, string | null | undefined][] = [
    ["g:id", field(variant, "sku")],
    ["g:item_group_id", field(product, "handle")],
    ["title", named ? `${field(product, "title")} - ${named}` : field(product, "title")],
    ["link", `${origin}/urun/${field(product, "handle")}`],
    ["description", field(product, "descriptionHtml")],
    ["g:product_type", category ? field(category, "title") : null],
    ["g:brand", field(product, "vendor")],
    ["g:image_link", picture],
    ["g:price", `${typeof before === "string" ? before : field(variant, "price")} TRY`],
    ["g:sale_price", typeof before === "string" ? `${field(variant, "price")} TRY` : null],
    ["g:availability", Number(variant["inventoryQuantity"]) > 0 ? "in_stock" : "out_of_stock"],
    ["g:gtin", field(variant, "barcode") || null],
    ["g:product_weight", grams ? `${String(grams / 1000)} kg` : null],
    [option === "Boyut" ? "g:size" : "g:color", named],
  ]
  return `<item>${fields
    .filter(([, value]) => value)
    .map(([name, value]) => `<${name}>${xml(value ?? "")}</${name}>`)
    .join("")}</item>`
}

/**
 * The feed a tidy store publishes (`cleanShopifyStore`): a line per
 * variant, grouped by product, with its picture, brand, category, price
 * (and sale), stock, barcode and weight, every link on the store's address.
 */
export function storeFeed(origin: string, data: FakeShopifyData): string {
  const items = data.products.flatMap((product) =>
    (product.children ?? [])
      .filter((child) => child.id.includes("/ProductVariant/"))
      .map((variant) => feedItem(origin, product, variant))
  )
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>${xml(data.shopName ?? "")}</title><link>${origin}</link><description>Ürünler</description>
${items.join("\n")}
</channel></rss>`
}

/**
 * A Google Merchant product feed as a Turkish platform publishes one
 * (RSS 2.0, `g:` attributes), for the migration's feed source and its
 * tests: a pan in two sizes (one on sale, one out of stock), a spoon, an
 * item priced in dollars and one without a price, on purpose. Entities as
 * a feed escapes them.
 */
export function merchantFeed(imageOrigin: string): string {
  const item = (fields: Record<string, string | string[]>) =>
    `<item>${Object.entries(fields)
      .flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((each) => `<${name}>${each}</${name}>`)
      )
      .join("")}</item>`
  const pan = {
    "g:item_group_id": "TAVA",
    title: "Döküm Tava - 24 cm",
    link: "https://eski-magaza.example/urun/dokum-tava",
    description: "&lt;p&gt;Ağır döküm gövde.&lt;/p&gt;",
    "g:product_type": "Mutfak &gt; Tavalar",
    "g:brand": "Demirci &amp; Oğulları",
    "g:color": "Siyah",
    "g:image_link": `${imageOrigin}/images/tava.png`,
    "g:additional_image_link": [`${imageOrigin}/images/tava-yan.png`],
    "g:product_weight": "1.5 kg",
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Eski Mağaza</title><link>https://eski-magaza.example</link><description>Ürünler</description>
${[
  item({
    ...pan,
    "g:id": "TAVA-24",
    "g:size": "24 cm",
    "g:price": "1099.90 TRY",
    "g:sale_price": "899.90 TRY",
    "g:availability": "in_stock",
    "g:gtin": "8690000000011",
  }),
  item({
    ...pan,
    "g:id": "TAVA-28",
    title: "Döküm Tava - 28 cm",
    "g:size": "28 cm",
    "g:price": "1299.90 TRY",
    "g:availability": "out_of_stock",
  }),
  item({
    "g:id": "KASIK",
    title: "Ahşap Kaşık",
    link: "https://eski-magaza.example/ahsap-kasik.html",
    description: "Zeytin ağacı.",
    "g:product_type": "Mutfak &gt; Gereçler",
    "g:brand": "Demirci &amp; Oğulları",
    "g:image_link": `${imageOrigin}/images/kasik.png`,
    "g:price": "149.00 TRY",
    "g:availability": "in_stock",
  }),
  item({
    "g:id": "DOLAR",
    title: "Dolar Ürün",
    link: "https://eski-magaza.example/dolar",
    "g:price": "10.00 USD",
  }),
  item({ "g:id": "FIYATSIZ", title: "Fiyatsız", link: "https://eski-magaza.example/fiyatsiz" }),
].join("\n")}
</channel></rss>`
}
