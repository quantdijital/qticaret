import { kurus } from "../../../lib/money"
import { DISCOUNT_RULE } from "../../../lib/pricing"
import type { PriceDisplay } from "../../../lib/pricing"
import { productFacts } from "../facts"
import type { FactRow } from "../facts"

const stock = (available: number) => [
  { inventory: { location_levels: [{ available_quantity: available }] } },
]

const row = (overrides: Partial<FactRow> = {}): FactRow => ({
  title: "Keten Gömlek",
  handle: "keten-gomlek",
  thumbnail: "https://cdn.example.com/kapak.webp",
  images: [
    { url: "https://cdn.example.com/2.webp", rank: 1 },
    { url: "https://cdn.example.com/1.webp", rank: 0 },
  ],
  product_extension: { condition: "used" },
  attribute_template: {
    definitions: [
      { scope: "variant", option_title: "Beden", varies_by: "size" },
      { scope: "variant", option_title: "Renk", varies_by: "color" },
      { scope: "product", option_title: null, varies_by: null },
    ],
  },
  variants: [
    {
      id: "variant_b",
      title: "L",
      variant_rank: 1,
      sku: "GMLK-L",
      ean: "1234",
      upc: null,
      barcode: "4006381333931",
      manage_inventory: true,
      allow_backorder: true,
      options: [{ value: "L", option: { title: "Beden" } }],
      prices: [{ amount: 949, currency_code: "try" }],
      inventory_items: stock(0),
    },
    {
      id: "variant_a",
      title: "M",
      variant_rank: 0,
      sku: " ",
      manage_inventory: true,
      allow_backorder: false,
      options: [{ value: "M", option: { title: "Beden" } }],
      prices: [
        { amount: 799, currency_code: "try", price_list_id: "plist_1" },
        { amount: 899, currency_code: "try" },
      ],
      inventory_items: stock(3),
    },
  ],
  ...overrides,
})

describe("productFacts", () => {
  it("orders variants as the shop shows them, with their codes, prices and stock", () => {
    const facts = productFacts(row(), "Örnek Marka", "Rahat kesim.")
    expect(facts).toMatchObject({
      groupId: "keten-gomlek",
      condition: "used",
      brand: "Örnek Marka",
      images: ["https://cdn.example.com/1.webp", "https://cdn.example.com/2.webp"],
      variesBy: ["size"],
      variants: [
        {
          id: "variant_a",
          name: "Keten Gömlek – M",
          sku: null,
          price: 899,
          availability: "InStock",
          properties: { size: "M" },
        },
        {
          id: "variant_b",
          gtin: "4006381333931",
          price: 949,
          availability: "BackOrder",
          properties: { size: "L" },
        },
      ],
    })
  })

  it("counts a variant without stock tracking as in stock and uses the cover without images", () => {
    const facts = productFacts(
      row({
        images: [],
        variants: [{ id: "variant_x", manage_inventory: false, inventory_items: stock(0) }],
      }),
      null,
      ""
    )
    expect(facts.images).toEqual(["https://cdn.example.com/kapak.webp"])
    expect(facts.variants[0]).toMatchObject({ availability: "InStock", price: null })
    expect(facts.variesBy).toEqual([])
  })

  it("prices offers as the shopper pays now, struck through only as the price-before rule allows", () => {
    const display = (current: number, before: number | null): PriceDisplay => ({
      current: kurus(current),
      regular: kurus(89_900),
      before: before === null ? null : kurus(before),
      lowest_before: before === null ? null : kurus(before),
      on_sale: before !== null,
      since: null,
      basis: before === null ? null : "history",
      rule_version: DISCOUNT_RULE.version,
    })
    const facts = productFacts(
      row(),
      null,
      "",
      // variant_b has no price a shopper can pay: no offer, not its own price
      new Map([["variant_a", display(79_990, 89_900)]])
    )
    expect(facts.variants.map((variant) => [variant.price, variant.strikethrough])).toEqual([
      [799.9, 899],
      [null, null],
    ])
  })

  it("gives an offer the shop's shipping rate and days when its table prices the variant (F7.8)", () => {
    const settings = {
      handling_days_min: 1,
      handling_days_max: 2,
      transit_days_min: 1,
      transit_days_max: 3,
      same_day_cutoff_hour: null,
      rate_table: [{ max_desi: 2, price: 4_990 }],
      over_desi_price: 0,
      label_format: "100x150" as const,
      label_custom: { width_mm: 100, height_mm: 150 },
      default_parcel: null,
      packing_slip_prices: false,
    }
    const units = { weight_unit: "g", dimension_unit: "cm" } as const
    const measured = row({
      variants: (row().variants ?? []).map((variant, index) =>
        // One in a 1 desi box, the other without measures
        index === 0 && variant
          ? { ...variant, weight: 500, length: 20, width: 15, height: 10 }
          : variant
      ),
    })

    const facts = productFacts(measured, null, "", undefined, {
      settings,
      units,
      table_offered: true,
      free_shipping_threshold: null,
    })
    // No option shoppers see is priced by the table: its rate is not one checkout charges
    const unoffered = productFacts(measured, null, "", undefined, {
      settings,
      units,
      table_offered: false,
      free_shipping_threshold: null,
    })

    expect(facts.delivery).toEqual({ handling: [1, 2], transit: [1, 3] })
    // Without measures, as checkout prices it: the default parcel, 2 desi (adr/0054)
    expect(facts.variants.map((variant) => [variant.id, variant.shippingRate])).toEqual([
      ["variant_a", 49.9],
      ["variant_b", 49.9],
    ])
    // A feed's volume is the product's own, never the default's
    expect(facts.variants.map((variant) => [variant.id, variant.desi])).toEqual([
      ["variant_a", null],
      ["variant_b", 1],
    ])
    expect(unoffered.variants.map((variant) => variant.shippingRate)).toEqual([null, null])
    expect(productFacts(measured, null, "").delivery).toBeNull()
  })

  it("prices a product without measures by the shop's own default parcel, a digital one not at all", () => {
    const settings = {
      handling_days_min: 1,
      handling_days_max: 2,
      transit_days_min: 1,
      transit_days_max: 3,
      same_day_cutoff_hour: null,
      rate_table: [
        { max_desi: 2, price: 4_990 },
        { max_desi: 10, price: 9_990 },
      ],
      over_desi_price: 0,
      label_format: "100x150" as const,
      label_custom: { width_mm: 100, height_mm: 150 },
      // 5 kg: past the first band
      default_parcel: { weight: 5_000, length: 30, width: 20, height: 10 },
      packing_slip_prices: false,
    }
    const shipping = {
      settings,
      units: { weight_unit: "g", dimension_unit: "cm" } as const,
      table_offered: true,
      free_shipping_threshold: null,
    }
    const digital = row({ product_extension: { kind: "digital" } })

    expect(productFacts(row(), null, "", undefined, shipping).variants[0]?.shippingRate).toBe(99.9)
    expect(
      productFacts(digital, null, "", undefined, shipping).variants.map(
        (variant) => variant.shippingRate
      )
    ).toEqual([null, null])

    // adr/0087 §5: a unit priced at or past the threshold ships free by the table too
    const free = productFacts(row(), null, "", undefined, {
      ...shipping,
      free_shipping_threshold: 949,
    })
    expect(
      free.variants.map((variant) => [variant.id, variant.price, variant.shippingRate])
    ).toEqual([
      ["variant_a", 899, 99.9],
      ["variant_b", 949, 0],
    ])
  })
})
