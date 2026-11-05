import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import type { ShippingOption } from "@/lib/checkout/options"
import { t } from "@/lib/i18n"
import { cheapestShipping, notInCart, offersOf } from "../cart-extras"

/**
 * The cart page's extras (adr/0046 Ek 2026-11-05): shipping before an
 * address, the shop's cart offers in words, products to add. The amounts
 * are the backend's; nothing is priced here.
 */

const option = (amount: number | null): ShippingOption =>
  ({ id: "so_1", name: "Aras Kargo", amount, calculated_price: null }) as unknown as ShippingOption

describe("the cart's shipping estimate", () => {
  it("says free when the cheapest option costs nothing", () => {
    expect(cheapestShipping([option(0), option(95)], t)).toBe("Ücretsiz")
  })

  it("says the price, or where prices start when they differ", () => {
    expect(cheapestShipping([option(85), option(85)], t)).toBe("85,00 TL")
    expect(cheapestShipping([option(95), option(85)], t)).toBe("85,00 TL'den başlayan")
  })

  it("says nothing without a priced option", () => {
    expect(cheapestShipping([], t)).toBeNull()
    expect(cheapestShipping([option(null)], t)).toBeNull()
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
