import { describe, expect, it } from "vitest"
import {
  CARD_VARIANTS,
  SECTION_VARIANTS,
  cardVariantOf,
  defaultVariant,
  hasVariants,
  variantOf,
} from "../store/section-variants.js"

describe("section variants (adr/0049 Ek 2026-11-14 §2)", () => {
  it("defaults to the first variant, the drawing from before variants", () => {
    expect(defaultVariant("trust_badges")).toBe("strip")
    expect(SECTION_VARIANTS.trust_badges).toEqual(["strip", "lined"])
  })

  it("reads a listed variant as it is, and none or an unknown one as the default", () => {
    expect(variantOf("trust_badges", "lined")).toBe("lined")
    expect(variantOf("trust_badges", undefined)).toBe("strip")
    expect(variantOf("trust_badges", "bento")).toBe("strip")
    expect(variantOf("trust_badges", null)).toBe("strip")
  })

  it("offers a choice only for a type with more than one variant", () => {
    expect(hasVariants("trust_badges")).toBe(true)
    expect(hasVariants("faq")).toBe(false)
    expect(hasVariants("constructor")).toBe(false)
  })
})

describe("card variants (adr/0049 Ek 2026-11-14 §3.3)", () => {
  it("lists today's card first and reads anything else as it", () => {
    expect(CARD_VARIANTS).toEqual(["standard", "framed", "compact"])
    expect(cardVariantOf("framed")).toBe("framed")
    expect(cardVariantOf("technical")).toBe("standard")
    expect(cardVariantOf(undefined)).toBe("standard")
  })
})
