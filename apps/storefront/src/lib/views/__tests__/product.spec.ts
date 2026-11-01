import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { percentOff } from "../price"
import { productPage } from "../product"

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
        basis: "30d",
        rule_version: 1,
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

  it("strikes through only what the 30-day rule allows and reads the description as text", () => {
    const view = page(null)
    expect(view.variants[1]?.price).toEqual({
      current: "999,00 TL",
      before: "1.199,00 TL",
      from: false,
      discount: 16,
    })
    expect(view.variants[0]?.price?.before).toBeNull()
    expect(view.variants[0]?.available).toBe(false)
    expect(view.description).toEqual(["Yıkanmış keten.", "Rahat kesim & yazlık."])
    expect(view.breadcrumbs).toEqual([
      { label: "Ana sayfa", path: "/" },
      { label: "Keten Gömlek", path: null },
    ])
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
