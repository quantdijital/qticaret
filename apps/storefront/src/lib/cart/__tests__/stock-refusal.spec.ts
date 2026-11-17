import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { insufficientStockText, unitsOf } from "../stock-refusal"

describe("the cart page's sentence for too few units on the shelf", () => {
  it("names the count the address carries when it is a whole number 1 to 99", () => {
    expect(insufficientStockText("1", t)).toBe("Bu üründen stokta yalnız 1 adet var.")
    expect(insufficientStockText("10", t)).toBe("Bu üründen stokta yalnız 10 adet var.")
  })

  it("says only the sentence for anything else in the address", () => {
    for (const count of [undefined, "", "0", "100", "-1", "2.5", "1e2", ["3"], "3<script>"]) {
      expect(insufficientStockText(count, t)).toBe("Bu üründen stokta istediğiniz kadar yok.")
    }
  })

  it("reads only strings of digits", () => {
    expect(unitsOf("7")).toBe(7)
    expect(unitsOf(7)).toBeNull()
    expect(unitsOf("07")).toBeNull()
  })
})
