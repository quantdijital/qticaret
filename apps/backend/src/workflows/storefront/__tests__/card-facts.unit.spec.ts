import { quickAddOf, stockBucketOf } from "../card-facts"

// adr/0046 Ek 2026-11-04: a card's stock as a bucket, and its quick add
describe("stockBucketOf", () => {
  const counted = (id: string) => ({ id, manage_inventory: true, allow_backorder: false })
  const stock: Record<string, number> = { a: 2, b: 1, c: 0, d: 10 }
  const available = (id: string) => stock[id] ?? 0

  it("sums the counted variants and says low at the shop's threshold or under", () => {
    expect(stockBucketOf([counted("a"), counted("b")], available, 3)).toBe("low")
    expect(stockBucketOf([counted("a"), counted("d")], available, 3)).toBe("in_stock")
    expect(stockBucketOf([counted("c")], available, 3)).toBe("out")
  })

  it("never says low with the threshold at 0", () => {
    expect(stockBucketOf([counted("b")], available, 0)).toBe("in_stock")
  })

  it("is in stock when a variant keeps no count or sells past zero", () => {
    expect(stockBucketOf([counted("c"), { id: "x", manage_inventory: false }], available, 3)).toBe(
      "in_stock"
    )
    expect(
      stockBucketOf([{ id: "c", manage_inventory: true, allow_backorder: true }], available, 3)
    ).toBe("in_stock")
  })

  it("reads a negative count as none and a product without variants as out", () => {
    expect(stockBucketOf([counted("n")], () => -4, 3)).toBe("out")
    expect(stockBucketOf([], available, 3)).toBe("out")
  })
})

describe("quickAddOf", () => {
  const one = { id: "prod_1", variants: [{ id: "variant_1" }] }
  const required = {
    items: [
      {
        id: "ad_1",
        kind: "text",
        label: "Yazı",
        help: null,
        required: true,
        max_quantity: null,
        non_withdrawable: true,
        price: 0,
        text: { max_length: 20, charset: "text" },
      },
    ],
  }

  it("gives a single variant to be had", () => {
    expect(quickAddOf(one, "in_stock", false)).toEqual({ variant_id: "variant_1" })
    expect(quickAddOf(one, "low", true)).toEqual({ variant_id: "variant_1" })
  })

  it("leaves out several variants, an empty stock and a gift card", () => {
    expect(quickAddOf({ ...one, variants: [{ id: "a" }, { id: "b" }] }, "in_stock", false)).toBe(
      null
    )
    expect(quickAddOf(one, "out", false)).toBeNull()
    expect(
      quickAddOf({ ...one, product_extension: { is_gift_card: true } }, "in_stock", false)
    ).toBeNull()
  })

  it("leaves out a dated product: it is booked on its page (adr/0076 §5)", () => {
    expect(
      quickAddOf({ ...one, product_extension: { booking_mode: "departure" } }, "in_stock", false)
    ).toBeNull()
    expect(
      quickAddOf({ ...one, product_extension: { booking_mode: "none" } }, "in_stock", false)
    ).toEqual({ variant_id: "variant_1" })
  })

  it("leaves out a required add-on while the shop offers add-ons", () => {
    const product = { ...one, product_extension: { addons: required } }
    expect(quickAddOf(product, "in_stock", true)).toBeNull()
    expect(quickAddOf(product, "in_stock", false)).toEqual({ variant_id: "variant_1" })
  })
})
