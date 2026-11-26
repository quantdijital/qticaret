import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { allShipFree, freeShippingOf, surchargeLineOf, withShippingNotes } from "../cart"
import type { LineShipping } from "../cart"
import type { Cart } from "@/lib/cart/cart"
import type { CartLineView } from "@qticaret/ui"

describe("freeShippingOf", () => {
  it("says how much more, with the bar's fill rounded down", () => {
    expect(freeShippingOf(1250, 1500, t)).toEqual({
      message: "Ücretsiz kargo için 250,00 TL daha ekleyin",
      percent: 83,
      reached: false,
    })
  })

  it("says shipping is free at the threshold, float noise included", () => {
    expect(freeShippingOf(0.1 + 0.2 + 1499.7, 1500, t)).toEqual({
      message: "Siparişinizde kargo ücretsiz",
      percent: 100,
      reached: true,
    })
  })

  it("says nothing without a threshold or without items", () => {
    expect(freeShippingOf(1250, null, t)).toBeNull()
    expect(freeShippingOf(0, 1500, t)).toBeNull()
  })
})

describe("free-shipping products in the cart (adr/0087 §3)", () => {
  const line = (id: string, product: string, ships = true) => ({
    id,
    product_id: product,
    requires_shipping: ships,
  })
  const view = (id: string) => ({ id }) as CartLineView
  const FREE = new Map([["prod_free", "free"]])
  const shipping = (over: Partial<LineShipping> = {}): LineShipping => ({
    classes: FREE,
    surcharges: [],
    threshold: null,
    ...over,
  })

  it("says the cart's shipping is free when every line that travels is free", () => {
    expect(allShipFree([line("l1", "prod_free"), line("l2", "prod_gift", false)], FREE)).toBe(true)
    expect(allShipFree([line("l1", "prod_free"), line("l2", "prod_paid")], FREE)).toBe(false)
    expect(allShipFree([line("l1", "prod_gift", false)], FREE)).toBe(false)
    expect(freeShippingOf(120, 1500, t, true)).toEqual({
      message: "Sepetinizdeki ürünlerin kargosu ücretsiz.",
      percent: 100,
      reached: true,
    })
    expect(freeShippingOf(120, null, t, true)?.reached).toBe(true)
  })

  it("notes the free lines of a mixed cart only", () => {
    const mixed = { items: [line("l1", "prod_free"), line("l2", "prod_paid")] } as unknown as Cart
    expect(withShippingNotes([view("l1"), view("l2")], mixed, shipping(), t)).toEqual([
      { id: "l1", shippingNote: "Ücretsiz kargo" },
      { id: "l2" },
    ])
    const allFree = { items: [line("l1", "prod_free")] } as unknown as Cart
    expect(withShippingNotes([view("l1")], allFree, shipping(), t)).toEqual([{ id: "l1" }])
  })
})

describe("a surcharged class under its line (adr/0087 §2.4, §2.5)", () => {
  const line = (id: string, product: string, ships = true) => ({
    id,
    product_id: product,
    requires_shipping: ships,
  })
  const view = (id: string) => ({ id }) as CartLineView
  const shipping: LineShipping = {
    classes: new Map([
      ["prod_bulky", "bulky"],
      ["prod_heavy", "heavy"],
      ["prod_free", "free"],
    ]),
    surcharges: [
      { key: "bulky", surcharge: 150 },
      { key: "heavy", surcharge: 250 },
    ],
    threshold: 1500,
  }
  const cart = (itemTotal: number, ...items: ReturnType<typeof line>[]) =>
    ({ items, item_total: itemTotal }) as unknown as Cart

  it("notes the surcharge under its line while the real cart is under the threshold", () => {
    const below = cart(900, line("l1", "prod_bulky"), line("l2", "prod_paid"))
    expect(withShippingNotes([view("l1"), view("l2")], below, shipping, t)).toEqual([
      { id: "l1", shippingNote: "Kargoya 150,00 TL eklenir" },
      { id: "l2" },
    ])
  })

  it("says nothing of it once the cart's own total reaches the threshold, exactly at it too", () => {
    const at = cart(1500, line("l1", "prod_bulky"))
    expect(surchargeLineOf(at, shipping)).toBeNull()
    expect(withShippingNotes([view("l1")], at, shipping, t)).toEqual([{ id: "l1" }])
    // Float noise on the total never keeps the note
    expect(surchargeLineOf(cart(0.1 + 0.2 + 1499.7, line("l1", "prod_bulky")), shipping)).toBeNull()
  })

  it("says it without a threshold whatever the total", () => {
    const none = { ...shipping, threshold: null }
    expect(surchargeLineOf(cart(99_999, line("l1", "prod_bulky")), none)).toEqual({
      lineId: "l1",
      amount: 150,
    })
  })

  it("names only the highest surcharge, once, as the order pays it", () => {
    const both = cart(
      500,
      line("l1", "prod_bulky"),
      line("l2", "prod_heavy"),
      line("l3", "prod_heavy")
    )
    expect(withShippingNotes([view("l1"), view("l2"), view("l3")], both, shipping, t)).toEqual([
      { id: "l1" },
      { id: "l2", shippingNote: "Kargoya 250,00 TL eklenir" },
      { id: "l3" },
    ])
  })

  it("ignores a line that does not travel and a class the shop no longer has", () => {
    expect(surchargeLineOf(cart(100, line("l1", "prod_bulky", false)), shipping)).toBeNull()
    const gone = { ...shipping, classes: new Map([["prod_old", "removed"]]) }
    expect(surchargeLineOf(cart(100, line("l1", "prod_old")), gone)).toBeNull()
  })

  it("keeps the free note in a mixed cart beside the surcharge", () => {
    const mixed = cart(300, line("l1", "prod_free"), line("l2", "prod_bulky"))
    expect(withShippingNotes([view("l1"), view("l2")], mixed, shipping, t)).toEqual([
      { id: "l1", shippingNote: "Ücretsiz kargo" },
      { id: "l2", shippingNote: "Kargoya 150,00 TL eklenir" },
    ])
  })
})
