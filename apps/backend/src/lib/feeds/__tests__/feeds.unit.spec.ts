import type { ProductFacts, VariantFacts } from "../../seo/jsonld"
import { productJsonLd } from "../../seo/jsonld"
import { feedItemsOf, googleFeedProblems, shippingCost } from ".."
import type { FeedShop } from ".."
import { googleFeed } from "../google"
import { metaFeed } from "../meta"

const variant = (over: Partial<VariantFacts>): VariantFacts => ({
  id: "variant_1",
  name: "Keten Gömlek – M",
  sku: "KG-M",
  gtin: "8690000000017",
  mpn: null,
  image: null,
  price: 499.9,
  availability: "InStock",
  properties: { size: "M" },
  ...over,
})

const facts = (variants: VariantFacts[], over: Partial<ProductFacts> = {}): ProductFacts => ({
  name: "Keten Gömlek",
  description: "Yazlık keten gömlek.",
  images: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"],
  brand: "Örnek & Co",
  condition: "new",
  groupId: "keten-gomlek",
  variesBy: ["size"],
  variants,
  ...over,
})

const URL = "https://magaza.example.com/urun/keten-gomlek"
const SHOP: FeedShop = {
  name: "Örnek Mağaza",
  url: "https://magaza.example.com",
  handlingDays: { min: 1, max: 2 },
  flatShipping: null,
  freeShippingFrom: null,
  sameDayCutoffHour: null,
}

describe("product feeds (F10.8, KK4)", () => {
  it("lists each variant with an offer and stock, at the page's own address and price", () => {
    const product = facts([
      variant({}),
      variant({ id: "variant_2", name: "Keten Gömlek – L", strikethrough: 599.9 }),
      variant({ id: "variant_3", availability: "OutOfStock" }),
      variant({ id: "variant_4", price: null }),
    ])
    const items = feedItemsOf(product, URL)
    const offers = (
      productJsonLd(product, URL)["hasVariant"] as { offers?: { url: string; price: string } }[]
    ).flatMap((each) => (each.offers ? [each.offers] : []))

    expect(items.map(({ id }) => id)).toEqual(["variant_1", "variant_2"])
    expect(items[0]).toMatchObject({ groupId: "keten-gomlek", link: `${URL}?variant=variant_1` })
    expect(items[1]).toMatchObject({ price: 499.9, strikethrough: 599.9 })
    // The same address and price as the JSON-LD offer of the variant
    expect(items.map(({ link, price }) => ({ url: link, price: price.toFixed(2) }))).toEqual(
      offers.slice(0, 2).map(({ url, price }) => ({ url, price }))
    )
  })

  it("keeps a product sold to adults only out of every feed (F13.4)", () => {
    const product = facts([variant({})], {
      adultConsideration: "https://schema.org/AlcoholConsideration",
    })

    expect(feedItemsOf(product, URL)).toEqual([])
  })

  it("writes a Google feed its specification takes, a sale with the price struck through", () => {
    const items = feedItemsOf(
      facts([variant({}), variant({ id: "variant_2", strikethrough: 599.9, gtin: null })], {
        name: "Keten <Gömlek>",
      }),
      URL
    )
    const xml = googleFeed.render(items, SHOP)

    expect(googleFeedProblems(xml)).toEqual([])
    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">')
    expect(xml).toContain("<g:brand>Örnek &amp; Co</g:brand>")
    expect(xml).toContain("<g:price>599.90 TRY</g:price><g:sale_price>499.90 TRY</g:sale_price>")
    expect(xml).toContain("<g:item_group_id>keten-gomlek</g:item_group_id>")
    expect(xml).toContain("<g:size>M</g:size>")
    // No GTIN and no MPN: Google is told there is none
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>")
  })

  it("leaves out an item without an image, and a preorder from Google, which would need its date", () => {
    const [preorder] = feedItemsOf(facts([variant({ availability: "PreOrder" })]), URL)
    const [bare] = feedItemsOf(facts([variant({})], { images: [] }), URL)

    expect(preorder && googleFeed.accepts(preorder)).toBe(false)
    expect(preorder && metaFeed.accepts(preorder)).toBe(true)
    expect(bare && googleFeed.accepts(bare)).toBe(false)
    expect(bare && metaFeed.accepts(bare)).toBe(false)
  })

  it("finds what Google would refuse", () => {
    const xml = googleFeed
      .render(feedItemsOf(facts([variant({})], { brand: null }), URL), SHOP)
      .replace("<g:price>499.90 TRY</g:price>", "<g:price>499,90 TL</g:price>")
      .replace(/<g:gtin>[^<]*<\/g:gtin>/, "")

    expect(googleFeedProblems(xml).map(({ problem }) => problem)).toEqual([
      "g:price not like 15.00 TRY",
      "g:brand missing without identifier_exists no",
    ])
    expect(googleFeedProblems("<rss><channel/></rss>")).toHaveLength(1)
  })

  it("writes Meta's CSV, quoting what needs it and starting no formula", () => {
    const csv = metaFeed.render(
      feedItemsOf(
        facts([variant({ properties: { size: "\t+SUM(A1)" } })], {
          name: '=HYPERLINK("x")',
          description: "Bir, iki; -cmd|' /C calc'!A0",
        }),
        URL
      ),
      SHOP
    )
    const [header, line] = csv.split("\n")

    expect(header?.startsWith("id,title,description,availability,condition,price")).toBe(true)
    expect(line).toContain(`"'=HYPERLINK(""x"")"`)
    // A formula after a semicolon, where Turkish Excel splits, and one behind a tab start neither
    expect(line).toContain(`"Bir, iki; '-cmd|' /C calc'!A0"`)
    expect(line).toContain(`"'\t+SUM(A1)"`)
    expect(line).toContain("in stock,new,499.90 TRY")
  })
})

describe("a feed's shipping cost (adr/0087 §5)", () => {
  const item = (price: number, shippingRate: number | null) => {
    const [first] = feedItemsOf(facts([variant({ price, shippingRate })]), URL)
    if (!first) {
      throw new Error("no feed item")
    }
    return first
  }

  it("is the table's rate, else the cheapest flat rate, free past the threshold with either", () => {
    const shop = { ...SHOP, flatShipping: 39.9, freeShippingFrom: 500 }
    expect(shippingCost(item(499.9, 49.9), shop)).toBe(49.9)
    expect(shippingCost(item(499.9, null), shop)).toBe(39.9)
    // The desi table is free from the threshold as checkout now charges it
    expect(shippingCost(item(500, 49.9), shop)).toBe(0)
    expect(shippingCost(item(750, null), shop)).toBe(0)
  })

  it("says nothing when no option prices the item, threshold or not", () => {
    expect(shippingCost(item(750, null), { ...SHOP, freeShippingFrom: 500 })).toBeNull()
    expect(shippingCost(item(100, 49.9), SHOP)).toBe(49.9)
  })
})

describe("a feed's shipping cost by the product's class (adr/0087 §5)", () => {
  const item = (
    shippingRate: number | null,
    shippingClass: { free: boolean; surcharge: number }
  ) => {
    const [first] = feedItemsOf(
      facts([variant({ price: 100, shippingRate })], { shippingClass }),
      URL
    )
    if (!first) {
      throw new Error("no feed item")
    }
    return first
  }
  const shop = { ...SHOP, flatShipping: 39.9, freeShippingFrom: 500 }

  it("is free for a free-shipping product, the flat rate and its surcharge otherwise", () => {
    expect(shippingCost(item(null, { free: true, surcharge: 0 }), shop)).toBe(0)
    expect(shippingCost(item(null, { free: false, surcharge: 150 }), shop)).toBe(189.9)
    // The table's rate holds its class already
    expect(shippingCost(item(199.9, { free: false, surcharge: 150 }), shop)).toBe(199.9)
  })
})
