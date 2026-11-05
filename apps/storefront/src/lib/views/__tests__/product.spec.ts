import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { cardPrice, cartOfferText, percentOff } from "../price"
import { productPage } from "../product"

const displayOf = (current: string) => ({
  current,
  regular: "999.00",
  before: "999.00",
  on_sale: true,
  since: null,
  basis: "history",
  rule_version: "tr-10d-1",
})

const product: StoreProduct = {
  id: "prod_1",
  title: "Keten Gömlek",
  handle: "keten-gomlek",
  subtitle: null,
  description: "<p>Yıkanmış keten.</p><p>Rahat kesim &amp; yazlık.</p>",
  thumbnail: null,
  options: [
    {
      id: "opt_size",
      title: "Beden",
      values: [
        { id: "optval_s", value: "S" },
        { id: "optval_m", value: "M" },
      ],
    },
  ],
  variants: [
    {
      id: "variant_s",
      title: "S",
      sku: "KG-S",
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: 0,
      options: [{ id: "optval_s", value: "S" }],
      calculated_price: { calculated_amount: 899, original_amount: 899, currency_code: "try" },
    },
    {
      id: "variant_m",
      title: "M",
      sku: "KG-M",
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: 3,
      options: [{ id: "optval_m", value: "M" }],
      calculated_price: { calculated_amount: 999, original_amount: 999, currency_code: "try" },
    },
  ],
}

const page = (requestedVariant: string | null) =>
  productPage({
    product,
    seo: null,
    displays: {
      variant_m: {
        current: "999.00",
        regular: "1199.00",
        before: "1199.00",
        on_sale: true,
        since: null,
        basis: "history",
        rule_version: "tr-10d-1",
      },
    },
    brandPath: null,
    requestedVariant,
    t,
    trustBadges: [],
  })

describe("productPage", () => {
  it("matches variant options by their value records, without option_id", () => {
    expect(page(null).variants.map((variant) => variant.options)).toEqual([
      { opt_size: "S" },
      { opt_size: "M" },
    ])
  })

  it("chooses ?variant= when it exists, else the first variant in stock", () => {
    expect(page("variant_s").selectedVariantId).toBe("variant_s")
    expect(page(null).selectedVariantId).toBe("variant_m")
    expect(page("variant_unknown").selectedVariantId).toBe("variant_m")
  })

  it("shows the price an automatic promotion gives, and a cart offer beside it (adr/0023 Ek 2026-11-05)", () => {
    const view = productPage({
      product,
      seo: null,
      displays: {
        // The backend's display: 30% off for everyone, and 10% more past 2.000 TL
        variant_m: {
          current: "699.30",
          regular: "999.00",
          before: "999.00",
          on_sale: true,
          since: "2026-11-02T00:00:00.000Z",
          basis: "history",
          rule_version: "tr-10d-1",
          cart_offer: { type: "percentage", value: 10, minimum: "2000.00" },
        },
      },
      brandPath: null,
      requestedVariant: null,
      t,
      trustBadges: [],
    })
    expect(view.variants[1]?.price).toEqual({
      current: "699,30 TL",
      before: "999,00 TL",
      from: false,
      discount: 30,
      saving: "299,70 TL",
      cartOffer: "2.000,00 TL ve üzeri sepette %10 indirim",
    })
    // The add-ons' running total starts from the price shown
    expect(view.variants[1]?.kurus).toBe(69930)
    // A variant the display does not know keeps Medusa's price
    expect(view.variants[0]?.price?.current).toBe("899,00 TL")
    // A card's "from" price is the lowest the shopper pays: the promoted one here
    expect(cardPrice(product.variants ?? [], { variant_m: displayOf("699.30") })).toMatchObject({
      current: "699,30 TL",
      from: true,
    })
  })

  it("words a cart offer by its kind and minimum, and none it cannot read", () => {
    expect(cartOfferText({ type: "percentage", value: 12.5, minimum: null }, t)).toBe(
      "Sepette %12,5 indirim"
    )
    expect(cartOfferText({ type: "fixed", value: "50.00", minimum: null }, t)).toBe(
      "Sepette 50,00 TL indirim"
    )
    expect(cartOfferText({ type: "fixed", value: "50.00", minimum: "750.00" }, t)).toBe(
      "750,00 TL ve üzeri sepette 50,00 TL indirim"
    )
    expect(cartOfferText({ type: "percentage", value: "x", minimum: null }, t)).toBeNull()
    expect(cartOfferText(null, t)).toBeNull()
  })

  it("strikes through only what the price-before rule allows and reads the description as text", () => {
    const view = page(null)
    expect(view.variants[1]?.price).toEqual({
      current: "999,00 TL",
      before: "1.199,00 TL",
      from: false,
      discount: 16,
      saving: "200,00 TL",
    })
    expect(view.variants[0]?.price?.before).toBeNull()
    expect(view.variants[0]?.available).toBe(false)
    expect(view.description).toEqual(["Yıkanmış keten.", "Rahat kesim & yazlık."])
    // No content document: the paragraphs are the description (adr/0055)
    expect(view.descriptionHtml).toBeNull()
    expect(view.breadcrumbs).toEqual([
      { label: "Ana sayfa", path: "/" },
      { label: "Keten Gömlek", path: null },
    ])
  })

  it("carries the backend's HTML of the product's content document beside its plain text", () => {
    const html = "<h2>Bakım</h2><ul><li><p>Elde yıkayın.</p></li></ul>"
    const view = productPage({
      product,
      seo: null,
      displays: {},
      brandPath: null,
      requestedVariant: null,
      t,
      trustBadges: [],
      descriptionHtml: html,
    })
    expect(view.descriptionHtml).toBe(html)
    // The plain text stays: the derived description a theme falls back to
    expect(view.description).toEqual(["Yıkanmış keten.", "Rahat kesim & yazlık."])
  })
})

describe("percentOff", () => {
  it("rounds down, and gives nothing without a real cut", () => {
    expect(percentOff(1199, 999)).toBe(16)
    expect(percentOff(100, 75)).toBe(25)
    expect(percentOff(100, 99.5)).toBeNull()
    expect(percentOff(100, 100)).toBeNull()
    expect(percentOff(100, 120)).toBeNull()
  })
})
