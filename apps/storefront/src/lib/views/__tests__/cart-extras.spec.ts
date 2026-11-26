import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { notInCart, offersOf } from "../cart-extras"
import { drawerShippingOf, shippingEstimateText } from "../shipping-estimate"

/**
 * The cart page's extras (adr/0046 Ek 2026-11-05): shipping before an
 * address, the shop's cart offers in words, products to add. The amounts
 * are the backend's; nothing is priced here.
 */

describe("the cart's shipping estimate (the backend's, before an address)", () => {
  it("says free, or the server's figure", () => {
    expect(shippingEstimateText({ status: "free", amount: null }, t)).toBe("Ücretsiz")
    expect(shippingEstimateText({ status: "priced", amount: 90 }, t)).toBe("90,00 TL")
    expect(shippingEstimateText({ status: "priced", amount: 240.5 }, t)).toBe("240,50 TL")
    // A zero figure is free in words
    expect(shippingEstimateText({ status: "priced", amount: 0 }, t)).toBe("Ücretsiz")
  })

  it("leaves to the checkout what only it can price, never guessing", () => {
    expect(shippingEstimateText({ status: "at_checkout", amount: null }, t)).toBe(
      "Ödeme adımında hesaplanır"
    )
    // An answer this build does not know, or a priced one without its figure
    expect(shippingEstimateText({ status: "by_province", amount: 50 }, t)).toBe(
      "Ödeme adımında hesaplanır"
    )
    expect(shippingEstimateText({ status: "priced", amount: null }, t)).toBe(
      "Ödeme adımında hesaplanır"
    )
  })

  it("says nothing when nothing travels or the backend gave no answer", () => {
    expect(shippingEstimateText({ status: "not_needed", amount: null }, t)).toBeNull()
    expect(shippingEstimateText(null, t)).toBeNull()
  })

  it("puts only a figure in the drawer; its note says the rest", () => {
    expect(drawerShippingOf({ status: "priced", amount: 90 }, t)).toBe("90,00 TL")
    expect(drawerShippingOf({ status: "free", amount: null }, t)).toBe("Ücretsiz")
    expect(drawerShippingOf({ status: "at_checkout", amount: null }, t)).toBeNull()
    expect(drawerShippingOf(null, t)).toBeNull()
  })
})

describe("the cart's offers and products to add", () => {
  it("says each automatic cart offer once, in words", () => {
    const display = {
      current: "100.00",
      regular: "100.00",
      before: null,
      on_sale: false,
      since: null,
      basis: "regular",
      rule_version: "tr-10d-1",
      cart_offer: { type: "percentage", value: 10, minimum: "2000.00" },
    }
    const offers = offersOf(
      { a: display, b: display, c: { ...display, cart_offer: null } } as never,
      t
    )
    expect(offers).toEqual(["2.000,00 TL ve üzeri sepette %10 indirim"])
  })

  it("never offers what the cart holds", () => {
    const products = ["a", "b", "c", "d", "e"].map((id) => ({ id }) as StoreProduct)
    expect(notInCart(products, new Set(["b"]), 3).map(({ id }) => id)).toEqual(["a", "c", "d"])
  })
})
