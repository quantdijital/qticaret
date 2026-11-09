import { copyHandles } from "../handle"
import { copyPlan, copyTitle, optionKey } from "../plan"
import type { SourceProduct } from "../plan"

const ALL_ON = { giftCards: true, addons: true, restricted: true }

const source = (fields: Partial<SourceProduct> = {}): SourceProduct => ({
  id: "prod_src",
  title: "Şef Bıçağı",
  subtitle: "20 cm",
  description: "Paslanmaz çelik.",
  thumbnail: "https://cdn.example/a.jpg",
  weight: 250,
  type_id: "ptyp_1",
  collection_id: null,
  tags: [{ id: "ptag_1" }],
  categories: [{ id: "pcat_1" }, null],
  sales_channels: [{ id: "sc_1" }],
  shipping_profile: { id: "sp_1" },
  images: [
    { url: "https://cdn.example/b.jpg", rank: 1, variants: [{ id: "variant_2" }] },
    { url: "https://cdn.example/a.jpg", rank: 0, variants: [] },
  ],
  options: [{ id: "opt_1", title: "Boyut", values: [{ value: "20 cm" }, { value: "25 cm" }] }],
  variants: [
    {
      id: "variant_2",
      title: "25 cm",
      variant_rank: 1,
      manage_inventory: true,
      options: [{ value: "25 cm", option_id: "opt_1" }],
      prices: [
        { amount: 1500, currency_code: "try" },
        { amount: 1200, currency_code: "try", price_list_id: "plist_1" },
        { amount: 1400, currency_code: "try", rules_count: 1 },
      ],
      variant_extension: { cost: 80_050 },
    },
    {
      id: "variant_1",
      title: "20 cm",
      variant_rank: 0,
      manage_inventory: false,
      allow_backorder: true,
      options: [{ value: "20 cm", option_id: "opt_1" }],
      prices: [{ amount: "1000", currency_code: "try" }],
    },
  ],
  brand: { id: "brand_1" },
  seo_meta: {
    seo_title: "Şef bıçağı",
    seo_description: "Mutfak için.",
    canonical_override: "/urun/sef-bicagi",
    focus_keyword: null,
  },
  product_extension: {
    condition: "new",
    kind: "physical",
    primary_category_id: "pcat_1",
    withdrawal_excluded: true,
    restriction: "weapon",
    is_gift_card: false,
    addons: {
      items: [
        {
          id: "ad_1",
          kind: "text",
          label: "İsim",
          help: null,
          required: false,
          max_quantity: null,
          non_withdrawable: true,
          price: 50,
          text: { max_length: 20, charset: "letters_digits" },
        },
      ],
    },
    description_doc: { type: "doc", content: [] },
    summary_doc: null,
  },
  ...fields,
})

describe("a product's copy (Kopyala)", () => {
  it("is a draft named as a copy on the given address, codes and stock left out", () => {
    const plan = copyPlan(source(), "sef-bicagi-kopya", ALL_ON)
    expect(plan.create).toMatchObject({
      title: "Şef Bıçağı (kopya)",
      handle: "sef-bicagi-kopya",
      status: "draft",
      subtitle: "20 cm",
      type_id: "ptyp_1",
      shipping_profile_id: "sp_1",
      categories: [{ id: "pcat_1" }],
      sales_channels: [{ id: "sc_1" }],
      images: [{ url: "https://cdn.example/a.jpg" }, { url: "https://cdn.example/b.jpg" }],
      options: [{ title: "Boyut", values: ["20 cm", "25 cm"] }],
    })
    expect(plan.create).not.toHaveProperty("collection_id")
    const variants = plan.create["variants"] as Record<string, unknown>[]
    expect(variants.map((variant) => variant["title"])).toEqual(["20 cm", "25 cm"])
    expect(variants[1]).toEqual({
      title: "25 cm",
      variant_rank: 1,
      manage_inventory: true,
      allow_backorder: false,
      options: { Boyut: "25 cm" },
      // The base price only: a price list's and a region rule's are not the product's own
      prices: [{ currency_code: "try", amount: 1500 }],
    })
    for (const variant of variants) {
      for (const code of ["sku", "ean", "upc", "barcode"]) {
        expect(variant).not.toHaveProperty(code)
      }
    }
    expect(plan.variantImages).toEqual([
      { options: { Boyut: "25 cm" }, image_urls: ["https://cdn.example/b.jpg"] },
    ])
  })

  it("carries the catalog marks, unit costs in lira, brand and search texts, never the canonical", () => {
    const plan = copyPlan(source(), "x", ALL_ON, {
      template_id: "atpl_1",
      values: { blade: "çelik" },
    })
    expect(plan.catalog).toMatchObject({
      condition: "new",
      kind: "physical",
      primary_category_id: "pcat_1",
      withdrawal_excluded: true,
      restriction: "weapon",
      description_doc: { type: "doc", content: [] },
    })
    expect(plan.catalog.addons?.[0]).toMatchObject({ id: "ad_1", label: "İsim", price: 50 })
    expect(plan.catalog).not.toHaveProperty("summary_doc")
    expect(plan.catalog).not.toHaveProperty("successor_product_id")
    expect(plan.costs).toEqual({ [optionKey({ Boyut: "25 cm" })]: 800.5 })
    expect(plan.brand_id).toBe("brand_1")
    expect(plan.seo).toEqual({ seo_title: "Şef bıçağı", seo_description: "Mutfak için." })
    expect(plan.attributes).toEqual({ template_id: "atpl_1", values: { blade: "çelik" } })
  })

  it("leaves out a mark whose flag is off and a stale primary category", () => {
    const plan = copyPlan(
      source({
        categories: [],
        product_extension: { ...source().product_extension, is_gift_card: true, kind: "digital" },
      }),
      "x",
      { giftCards: false, addons: false, restricted: false }
    )
    expect(plan.catalog).not.toHaveProperty("addons")
    expect(plan.catalog).not.toHaveProperty("restriction")
    expect(plan.catalog).not.toHaveProperty("is_gift_card")
    expect(plan.catalog).not.toHaveProperty("primary_category_id")
    expect(plan.catalog.kind).toBe("digital")
    const gift = copyPlan(
      source({ product_extension: { kind: "digital", is_gift_card: true } }),
      "x",
      ALL_ON
    )
    // A gift card's kind follows its mark
    expect(gift.catalog).toEqual({ is_gift_card: true })
    expect(
      copyPlan(source({ seo_meta: null }), "x", ALL_ON, { template_id: null, values: {} })
    ).toMatchObject({
      seo: null,
      attributes: null,
    })
  })

  it("keeps a long title within Medusa's length with its suffix", () => {
    expect(copyTitle("a".repeat(300))).toHaveLength(255)
    expect(copyTitle("  Çakı ")).toBe("Çakı (kopya)")
  })
})

describe("a copy's address", () => {
  it("counts up from -kopya and keeps the tail within a slug's length", () => {
    expect(copyHandles("sef-bicagi", 3)).toEqual([
      "sef-bicagi-kopya",
      "sef-bicagi-kopya-2",
      "sef-bicagi-kopya-3",
    ])
    const long = copyHandles("a".repeat(80), 1)[0] ?? ""
    expect(long.length).toBeLessThanOrEqual(80)
    expect(long.endsWith("-kopya")).toBe(true)
  })
})
