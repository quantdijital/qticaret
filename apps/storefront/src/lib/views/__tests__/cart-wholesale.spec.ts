import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { orderUnits, wholesaleCheckoutBlocked, wholesaleMinimumText } from "../cart-wholesale"

/** ADR-0068 §8: a wholesaler's minimum units, said on the cart page while the cart is short. */

const line = (quantity: number, variant_id: string | null = "variant_1") => ({
  quantity,
  variant_id,
})
const WHOLESALER = { active: true, minQuantity: 10 }

describe("a wholesale cart's units", () => {
  it("counts product lines as the backend does, not the fee of paying at the door", () => {
    expect(orderUnits([line(4), line(3), line(1, null)])).toBe(7)
  })
})

describe("the cart's minimum notice", () => {
  it("says the minimum and the count while the cart is short", () => {
    expect(wholesaleMinimumText({ items: [line(4)] }, WHOLESALER, t)).toBe(
      "Toptan siparişte en az 10 adet gerekir; sepetinizde 4 adet var."
    )
  })

  it("says nothing once the cart reaches it, for an empty cart, or for anyone else", () => {
    expect(wholesaleMinimumText({ items: [line(10)] }, WHOLESALER, t)).toBeNull()
    expect(wholesaleMinimumText({ items: [] }, WHOLESALER, t)).toBeNull()
    expect(wholesaleMinimumText(null, WHOLESALER, t)).toBeNull()
    expect(
      wholesaleMinimumText({ items: [line(1)] }, { ...WHOLESALER, active: false }, t)
    ).toBeNull()
    expect(
      wholesaleMinimumText({ items: [line(1)] }, { active: true, minQuantity: null }, t)
    ).toBeNull()
  })
})

describe("the cart's checkout button", () => {
  it("is held back with the minimum as its reason while the cart is short", () => {
    expect(wholesaleCheckoutBlocked({ items: [line(4)] }, WHOLESALER, t)).toEqual({
      reason: "Toptan siparişte en az 10 adet gerekir; sepetinizde 4 adet var.",
    })
  })

  it("is left as ever once the cart reaches it, or for anyone else", () => {
    expect(wholesaleCheckoutBlocked({ items: [line(10)] }, WHOLESALER, t)).toBeNull()
    expect(
      wholesaleCheckoutBlocked({ items: [line(1)] }, { ...WHOLESALER, active: false }, t)
    ).toBeNull()
  })
})
