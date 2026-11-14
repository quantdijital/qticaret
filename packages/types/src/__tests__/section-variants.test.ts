import { describe, expect, it } from "vitest"
import {
  SECTION_VARIANTS,
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
