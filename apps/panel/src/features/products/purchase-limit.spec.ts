import { describe, expect, it } from "vitest"
import { readLimit } from "@/features/products/purchase-limit"

describe("the most per order field (S5)", () => {
  it("reads empty as no limit and a whole number from 1 to 9999", () => {
    expect(readLimit("")).toBeNull()
    expect(readLimit("  ")).toBeNull()
    expect(readLimit("1")).toBe(1)
    expect(readLimit(" 12 ")).toBe(12)
    expect(readLimit("9999")).toBe(9999)
  })

  it("refuses zero, fractions, signs, words and too much", () => {
    for (const wrong of ["0", "1.5", "-2", "+3", "on", "10000", "1e3"]) {
      expect(readLimit(wrong)).toBeUndefined()
    }
  })
})
