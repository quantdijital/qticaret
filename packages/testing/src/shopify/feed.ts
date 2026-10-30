/**
 * A Google Merchant product feed as a Turkish platform publishes one
 * (RSS 2.0, `g:` attributes), for the migration's feed source: a pan in
 * two sizes (one on sale, one out of stock), a spoon, an item priced in
 * dollars and one without a price. Entities as a feed escapes them.
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
