import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { freeShippingOf } from "../cart"

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
