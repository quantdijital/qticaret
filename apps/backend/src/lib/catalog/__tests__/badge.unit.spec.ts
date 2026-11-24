import { PRODUCT_BADGE_MAX, isBadgeText, productBadgeInput, storedBadgeOf } from "../badge"

// Built from code points: an editor or formatter cannot turn them into look-alike text
const char = (code: number) => String.fromCodePoint(code)
const ZERO_WIDTH_SPACE = char(0x200b)
const RIGHT_TO_LEFT_OVERRIDE = char(0x202e)
const FILLERS = [0x3164, 0x115f, 0x1160, 0x2800, 0xffa0].map(char)

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
    for (const text of [
      `Yeni${char(0)}`,
      `Ye${ZERO_WIDTH_SPACE}ni`,
      `${RIGHT_TO_LEFT_OVERRIDE}Yeni`,
    ]) {
      const result = productBadgeInput.safeParse(text)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe("catalog.badge_invalid")
    }
  })

  it("refuses blank fillers and a line with nothing a reader sees", () => {
    for (const filler of FILLERS) {
      expect(productBadgeInput.safeParse(filler.repeat(3)).success).toBe(false)
      expect(productBadgeInput.safeParse(`Yeni${filler}`).success).toBe(false)
      expect(isBadgeText(filler)).toBe(false)
    }
    // Symbols alone (no letter, digit or punctuation) draw no word
    expect(productBadgeInput.safeParse("★★★").success).toBe(false)
    expect(productBadgeInput.parse("%20 indirim")).toBe("%20 indirim")
    expect(productBadgeInput.parse("2+1")).toBe("2+1")
    expect(productBadgeInput.parse("Yeni!")).toBe("Yeni!")
  })

  it("reads a stored value as a badge only by the save's own rule", () => {
    expect(storedBadgeOf(" Sınırlı ")).toBe("Sınırlı")
    expect(storedBadgeOf(null)).toBeNull()
    expect(storedBadgeOf(42)).toBeNull()
    expect(storedBadgeOf("")).toBeNull()
    expect(storedBadgeOf(`Ye${ZERO_WIDTH_SPACE}ni`)).toBeNull()
    expect(storedBadgeOf(`${RIGHT_TO_LEFT_OVERRIDE}Yeni`)).toBeNull()
    for (const filler of FILLERS) {
      expect(storedBadgeOf(filler)).toBeNull()
    }
  })
})
