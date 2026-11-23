import { PRODUCT_BADGE_MAX, productBadgeInput, storedBadgeOf } from "../badge"

describe("a product's own badge", () => {
  it("cuts the ends and runs of spaces, and reads empty as none", () => {
    expect(productBadgeInput.parse("  Sınırlı   sayıda ")).toBe("Sınırlı sayıda")
    expect(productBadgeInput.parse("   ")).toBeNull()
  })

  it("takes at most 24 characters as a reader counts them", () => {
    expect(PRODUCT_BADGE_MAX).toBe(24)
    expect(productBadgeInput.parse("ç".repeat(24))).toBe("ç".repeat(24))
    const long = productBadgeInput.safeParse("x".repeat(25))
    expect(long.success).toBe(false)
    expect(long.error?.issues[0]?.message).toBe("catalog.badge_too_long")
  })

  it("refuses control and invisible characters", () => {
    for (const text of ["Yeni\u0000", "Ye​ni", "‮Yeni"]) {
      const result = productBadgeInput.safeParse(text)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe("catalog.badge_invalid")
    }
  })

  it("reads a stored value as a badge only when it is one", () => {
    expect(storedBadgeOf(" Sınırlı ")).toBe("Sınırlı")
    expect(storedBadgeOf(null)).toBeNull()
    expect(storedBadgeOf(42)).toBeNull()
    expect(storedBadgeOf("")).toBeNull()
  })
})
