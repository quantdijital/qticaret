import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { allShipFree, freeShippingOf, withShippingNotes } from "../cart"
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
  const FREE = new Set(["prod_free"])

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
    expect(withShippingNotes([view("l1"), view("l2")], mixed, FREE, t)).toEqual([
      { id: "l1", shippingNote: "Ücretsiz kargo" },
      { id: "l2" },
    ])
    const allFree = { items: [line("l1", "prod_free")] } as unknown as Cart
    expect(withShippingNotes([view("l1")], allFree, FREE, t)).toEqual([{ id: "l1" }])
  })
})
