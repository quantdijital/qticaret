import { describe, expect, it } from "vitest"
import {
  FOOTER_COLUMNS_DEFAULTS,
  FOOTER_COLUMNS_LIMITS,
  FOOTER_COLUMNS_SETTINGS,
} from "../store/section-footer.js"
import { SECTION_VARIANTS, defaultVariant, variantOf } from "../store/section-variants.js"

describe("the brand columns footer (adr/0049 Ek 2026-11-17)", () => {
  it("is a second variant: today's ledger stays the default", () => {
    expect(SECTION_VARIANTS.footer_bar).toEqual(["ledger", "brand_columns"])
    expect(defaultVariant("footer_bar")).toBe("ledger")
    expect(variantOf("footer_bar", "brand_columns")).toBe("brand_columns")
    expect(variantOf("footer_bar", "dark_rich")).toBe("ledger")
  })

  it("starts each step from its list's first, the strip on and no line about the shop", () => {
    for (const [setting, steps] of Object.entries(FOOTER_COLUMNS_SETTINGS)) {
      expect(steps[0]).toBe(
        FOOTER_COLUMNS_DEFAULTS[setting as keyof typeof FOOTER_COLUMNS_SETTINGS]
      )
    }
    expect(FOOTER_COLUMNS_DEFAULTS).toEqual({
      top_strip: true,
      about: null,
      ground: "well",
      badge_style: "card",
    })
    expect(FOOTER_COLUMNS_LIMITS.about).toBe(240)
  })
})
