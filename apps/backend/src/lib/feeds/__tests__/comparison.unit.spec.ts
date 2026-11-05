import type { ProductFacts, VariantFacts } from "../../seo/jsonld"
import { productInputOf } from "../../google/merchant"
import { excludedBy, feedItemsOf, feedText, googleFeedProblems, shippingCost } from ".."
import type { FeedItem, FeedShop } from ".."
import { akakceFeed } from "../akakce"
import { cimriFeed } from "../cimri"
import { googleFeed } from "../google"
import { metaFeed } from "../meta"

const variant = (over: Partial<VariantFacts>): VariantFacts => ({
  id: "variant_1",
  name: "Döküm Tava 28 cm",
  sku: "DT-28",
  gtin: "8690000000017",
  mpn: null,
  image: null,
  price: 1299.9,
  availability: "InStock",
  properties: {},
  stock: 7,
  desi: 4.5,
  ...over,
})

const facts = (variants: VariantFacts[], over: Partial<ProductFacts> = {}): ProductFacts => ({
  name: "Döküm Tava",
  description: "Ağır döküm tava.",
  images: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"],
  brand: "Örnek & Co",
  condition: "new",
  groupId: "dokum-tava",
  variesBy: [],
  variants,
  ...over,
})

const URL = "https://magaza.example.com/urun/dokum-tava"
const PLACE = { path: ["Mutfak", "Tavalar"], ids: ["pcat_mutfak", "pcat_tava"] }
const SHOP: FeedShop = {
  name: "Örnek Mağaza",
  url: "https://magaza.example.com",
  handlingDays: { min: 1, max: 3 },
  flatShipping: 89.9,
  freeShippingFrom: 1000,
  sameDayCutoffHour: 15,
}

const itemOf = (
  over: Partial<VariantFacts> = {},
  product: Partial<ProductFacts> = {}
): FeedItem => {
  const [item] = feedItemsOf(facts([variant(over)], product), URL, PLACE)
  if (!item) {
    throw new Error("no item")
  }
  return item
}

describe("price comparison feeds and shipping (F10.8)", () => {
  it("charges the desi table's rate, else the flat rate, free from the shop's basket total", () => {
    const cheap = itemOf({ price: 249.9 })

    expect(shippingCost(itemOf({ shippingRate: 120 }), SHOP)).toBe(120)
    expect(shippingCost(cheap, SHOP)).toBe(89.9)
    expect(shippingCost(itemOf(), SHOP)).toBe(0)
    expect(shippingCost(cheap, { ...SHOP, flatShipping: null })).toBeNull()
  })

  it("keeps out a category and everything under it", () => {
    const item = itemOf()

    expect(excludedBy(item, ["pcat_mutfak"])).toBe(true)
    expect(excludedBy(item, ["pcat_bahce"])).toBe(false)
  })

  it("writes Cimri's RSS: the shop's name for a missing brand, the SKU as MPN", () => {
    const xml = cimriFeed.render([itemOf({}, { brand: null, name: "Tava <28>" })], SHOP)

    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>')
    expect(xml).toContain("<title>Tava &lt;28&gt;</title>")
    expect(xml).toContain("<g:price>1299.90 TRY</g:price>")
    expect(xml).toContain("<g:availability>in stock</g:availability>")
    expect(xml).toContain("<g:brand>Örnek Mağaza</g:brand>")
    expect(xml).toContain("<g:mpn>DT-28</g:mpn>")
    expect(xml).toContain("<g:gtin>8690000000017</g:gtin>")
  })

  it("writes Akakçe's products: comma decimals for shipping and desi, stock and category", () => {
    const xml = akakceFeed.render([itemOf({ price: 249.9, strikethrough: 299.9 })], SHOP)

    expect(xml).toContain('<products xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">')
    expect(xml).toContain("<sku>DT-28</sku>")
    expect(xml).toContain("<listPrice>299.90</listPrice><price>249.90</price>")
    expect(xml).toContain("<shipPrice>89,90</shipPrice><shipmentVolume>4,50</shipmentVolume>")
    expect(xml).toContain(
      "<dayOfDelivery>3</dayOfDelivery><expressDeliveryTime>15</expressDeliveryTime>"
    )
    expect(xml).toContain("<quantity>7</quantity>")
    expect(xml).toContain("<productBrand>Örnek &amp; Co</productBrand>")
    expect(xml).toContain("<productCategory>Tavalar</productCategory>")
    expect(xml).toContain(
      "<additionalimages><imgUrl>https://cdn.example.com/2.jpg</imgUrl></additionalimages>"
    )
  })

  it("promises no same day and counts no stock the shop does not keep", () => {
    const xml = akakceFeed.render([itemOf({ stock: null, desi: null })], {
      ...SHOP,
      sameDayCutoffHour: null,
    })

    expect(xml).not.toContain("expressDeliveryTime")
    expect(xml).toContain("<quantity>99</quantity>")
    expect(xml).toContain("<shipmentVolume>1,00</shipmentVolume>")
  })

  it("lists on price comparison sites only what can be bought now, with its picture", () => {
    expect(cimriFeed.accepts(itemOf({ availability: "BackOrder" }))).toBe(false)
    expect(akakceFeed.accepts(itemOf({}, { images: [] }))).toBe(false)
    expect(akakceFeed.accepts(itemOf())).toBe(true)
  })

  it("tells Google and Meta the category path, the shipping and the handling days", () => {
    const item = itemOf({ price: 249.9 })
    const xml = googleFeed.render([item], SHOP)
    const [header, line] = metaFeed.render([item], SHOP).split("\n")
    const input = productInputOf(item, SHOP).productAttributes

    expect(googleFeedProblems(xml)).toEqual([])
    expect(xml).toContain("<g:product_type>Mutfak &gt; Tavalar</g:product_type>")
    expect(xml).toContain(
      "<g:shipping><g:country>TR</g:country><g:price>89.90 TRY</g:price></g:shipping>"
    )
    expect(xml).toContain(
      "<g:min_handling_time>1</g:min_handling_time><g:max_handling_time>3</g:max_handling_time>"
    )
    expect(header).toContain("product_type")
    expect(line).toContain("Mutfak > Tavalar")
    // Merchant API says what the feed says
    expect(input).toMatchObject({
      productTypes: ["Mutfak > Tavalar"],
      shipping: [{ country: "TR", price: { amountMicros: "89900000", currencyCode: "TRY" } }],
      minHandlingTime: "1",
      maxHandlingTime: "3",
    })
  })

  it("cuts a long text at a word within each feed's limit, the same in the file and the API", () => {
    // 6,000 characters of words: past every feed's 5,000, and Meta's 9,999 not
    const long = "Döküm, ağır tava. ".repeat(333).trim()
    const item = itemOf({}, { description: long, name: `Döküm Tava ${"uzun ".repeat(40)}` })
    const google = /<g:description>(.*?)<\/g:description>/.exec(googleFeed.render([item], SHOP))
    const akakce = /<description>(.*?)<\/description>/.exec(akakceFeed.render([item], SHOP))
    const input = productInputOf(item, SHOP).productAttributes as {
      title: string
      description: string
    }

    expect(feedText("Ağır döküm tava, kulplu", 18)).toBe("Ağır döküm tava…")
    // A word longer than half the room is cut inside, as before
    expect(feedText("Kısa çokçokçokuzunbirkelime", 12)).toBe("Kısa çokçok…")
    expect(feedText("Kısa metin", 20)).toBe("Kısa metin")
    for (const text of [google?.[1], akakce?.[1], input.description]) {
      expect(text?.length).toBeLessThanOrEqual(5000)
      // Ends on a whole word, its comma dropped: "… ağır tava. Döküm…"
      expect(text).toMatch(/(?:Döküm|ağır|tava\.)…$/u)
    }
    expect(input.description).toBe(google?.[1])
    expect(input.title.length).toBeLessThanOrEqual(150)
    expect(input.title).toMatch(/uzun…$/u)
  })
})
