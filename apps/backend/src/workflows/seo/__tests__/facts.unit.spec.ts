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

  it("prices offers as the shopper pays now, struck through only as the 30-day rule allows", () => {
    const display = (current: number, before: number | null): PriceDisplay => ({
      current: kurus(current),
      regular: kurus(89_900),
      before: before === null ? null : kurus(before),
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
})
