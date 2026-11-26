import { kurus } from "../../money"
import {
  campaignMayFreeShipping,
  conditionOf,
  freeShippingCodeRefusal,
  lowersShipping,
  standaloneThreshold,
} from "../free-shipping"
import type { FreeShippingCondition } from "../../../modules/platform-settings/sections/promotions"

const settings = (threshold: number | null, condition: FreeShippingCondition) => ({
  free_shipping_threshold: threshold,
  free_shipping_condition: condition,
})

// 250 TL in kuruş, and a little below and past it
const AT = kurus(25_000)
const BELOW = kurus(24_999)
const PAST = kurus(30_000)

describe("free shipping condition (Kargo ücreti, Koşul)", () => {
  it("reads a missing or unknown condition as it worked before the choice", () => {
    expect(conditionOf({})).toBe("amount_or_coupon")
    expect(conditionOf({ free_shipping_condition: "x" as FreeShippingCondition })).toBe(
      "amount_or_coupon"
    )
    expect(conditionOf({ free_shipping_condition: "amount" })).toBe("amount")
  })

  it("says the total frees shipping by itself unless it needs a coupon too", () => {
    expect(standaloneThreshold(settings(250, "amount"))).toBe(250)
    expect(standaloneThreshold(settings(250, "amount_or_coupon"))).toBe(250)
    expect(standaloneThreshold(settings(250, "amount_and_coupon"))).toBeNull()
    expect(standaloneThreshold(settings(null, "amount"))).toBeNull()
    expect(standaloneThreshold(settings(0, "amount"))).toBeNull()
  })

  it("lets a campaign lower shipping as the condition allows", () => {
    for (const total of [BELOW, AT, PAST]) {
      expect(campaignMayFreeShipping(settings(250, "amount"), total)).toBe(false)
      expect(campaignMayFreeShipping(settings(250, "amount_or_coupon"), total)).toBe(true)
    }
    expect(campaignMayFreeShipping(settings(250, "amount_and_coupon"), BELOW)).toBe(false)
    // Exactly the total counts, as the threshold does
    expect(campaignMayFreeShipping(settings(250, "amount_and_coupon"), AT)).toBe(true)
    expect(campaignMayFreeShipping(settings(250, "amount_and_coupon"), PAST)).toBe(true)
  })

  it("leaves campaigns alone while no total is set, whatever the condition", () => {
    for (const condition of ["amount", "amount_or_coupon", "amount_and_coupon"] as const) {
      expect(campaignMayFreeShipping(settings(null, condition), kurus(0))).toBe(true)
    }
  })

  it("says why a free shipping code is refused", () => {
    expect(freeShippingCodeRefusal(settings(250, "amount"), PAST)).toBe(
      "promotions.free_shipping_code_off"
    )
    expect(freeShippingCodeRefusal(settings(250, "amount_and_coupon"), BELOW)).toBe(
      "promotions.free_shipping_code_below_total"
    )
    expect(freeShippingCodeRefusal(settings(250, "amount_and_coupon"), AT)).toBeNull()
    expect(freeShippingCodeRefusal(settings(250, "amount_or_coupon"), BELOW)).toBeNull()
  })

  it("tells a campaign on shipping from one on the basket", () => {
    expect(lowersShipping({ target_type: "shipping_methods" })).toBe(true)
    expect(lowersShipping({ target_type: "order" })).toBe(false)
    expect(lowersShipping(null)).toBe(false)
  })
})
