import { describe, expect, it } from "vitest"
import {
  NEWSLETTER_FOOTER_ONLY,
  NEWSLETTER_LIMITS,
  newsletterHasNote,
  newsletterOnPage,
} from "../store/section-newsletter.js"
import { SECTION_VARIANTS, defaultVariant, variantOf } from "../store/section-variants.js"

describe("newsletter variants (adr/0049 Ek 2026-11-17 e-bülten)", () => {
  it("keeps today's drawing first, the default", () => {
    expect(SECTION_VARIANTS.newsletter).toEqual([
      "standard",
      "split",
      "image_card",
      "strip",
      "in_footer",
    ])
    expect(defaultVariant("newsletter")).toBe("standard")
    expect(variantOf("newsletter", undefined)).toBe("standard")
    expect(variantOf("newsletter", "bento")).toBe("standard")
    expect(variantOf("newsletter", "strip")).toBe("strip")
  })

  it("keeps the footer column variant to the footer's box", () => {
    expect(NEWSLETTER_FOOTER_ONLY).toEqual(["in_footer"])
    expect(newsletterOnPage("in_footer")).toBe(false)
    expect(SECTION_VARIANTS.newsletter.filter(newsletterOnPage)).toEqual([
      "standard",
      "split",
      "image_card",
      "strip",
    ])
  })

  it("draws the promise line only where the variant has room for it", () => {
    expect(SECTION_VARIANTS.newsletter.filter(newsletterHasNote)).toEqual(["split", "image_card"])
    expect(NEWSLETTER_LIMITS).toEqual({ description: 240, note: 80 })
  })
})
