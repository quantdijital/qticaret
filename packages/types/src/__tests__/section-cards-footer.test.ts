import { describe, expect, it } from "vitest"
import {
  CATEGORY_CARD_DEFAULTS,
  CATEGORY_CARD_LIMITS,
  CATEGORY_CARD_SETTINGS,
  CATEGORY_COLLAGE_DEFAULTS,
  CATEGORY_COLLAGE_SETTINGS,
} from "../store/section-categories.js"
import {
  FOOTER_BAR_DEFAULTS,
  FOOTER_BAR_SETTINGS,
  PAYMENT_BADGES,
  SOCIAL_NETWORKS,
} from "../store/section-footer.js"
import { SECTION_VARIANTS, defaultVariant, variantOf } from "../store/section-variants.js"

describe("the category cards' linked variant", () => {
  it("draws today's tiles by default, the linked cards on request", () => {
    expect(SECTION_VARIANTS.categories).toEqual(["tiles", "linked", "collage"])
    expect(defaultVariant("categories")).toBe("tiles")
    expect(variantOf("categories", "linked")).toBe("linked")
    expect(variantOf("categories", "collage")).toBe("collage")
    expect(variantOf("categories", "bento")).toBe("tiles")
  })

  it("starts every setting on its own list, five links within none to eight", () => {
    for (const [setting, steps] of Object.entries(CATEGORY_CARD_SETTINGS)) {
      const listed: readonly unknown[] = steps
      expect(listed).toContain(
        CATEGORY_CARD_DEFAULTS[setting as keyof typeof CATEGORY_CARD_SETTINGS]
      )
    }
    expect(CATEGORY_CARD_SETTINGS.columns).toEqual([2, 3, 4])
    expect(CATEGORY_CARD_DEFAULTS.links).toBe(5)
    expect(CATEGORY_CARD_LIMITS.links).toMatchObject({ min: 0, max: 8 })
  })
})

describe("the category cards' collage variant", () => {
  it("shares the cards' columns, starts every own setting on its list, the lead on", () => {
    for (const [setting, steps] of Object.entries(CATEGORY_COLLAGE_SETTINGS)) {
      const listed: readonly unknown[] = steps
      expect(listed).toContain(
        CATEGORY_COLLAGE_DEFAULTS[setting as keyof typeof CATEGORY_COLLAGE_SETTINGS]
      )
    }
    expect(CATEGORY_COLLAGE_SETTINGS.columns).toBe(CATEGORY_CARD_SETTINGS.columns)
    expect(CATEGORY_COLLAGE_SETTINGS.columns_mobile).toBe(CATEGORY_CARD_SETTINGS.columns_mobile)
    expect(CATEGORY_COLLAGE_SETTINGS.height).toEqual(["low", "medium", "high"])
    expect(CATEGORY_COLLAGE_DEFAULTS).toMatchObject({ height: "medium", lead: "on", links: 4 })
    expect(CATEGORY_COLLAGE_DEFAULTS.links).toBeLessThanOrEqual(CATEGORY_CARD_LIMITS.links.max)
  })
})

describe("the footer bar's own settings", () => {
  it("draws the footer as before by default: written profiles, no badges, no button, the name", () => {
    expect(FOOTER_BAR_DEFAULTS).toEqual({
      social: "text",
      payment_badges: [],
      back_to_top: false,
      back_to_top_side: "right",
      back_to_top_shape: "round",
      back_to_top_mobile: true,
      brand: "name",
    })
    expect(FOOTER_BAR_SETTINGS.brand).toEqual(["name", "logo"])
    for (const [setting, steps] of Object.entries(FOOTER_BAR_SETTINGS)) {
      expect(steps[0]).toBe(FOOTER_BAR_DEFAULTS[setting as keyof typeof FOOTER_BAR_SETTINGS])
    }
  })

  it("names the ways to pay and the networks once each", () => {
    expect(new Set(PAYMENT_BADGES).size).toBe(PAYMENT_BADGES.length)
    expect(new Set(SOCIAL_NETWORKS).size).toBe(SOCIAL_NETWORKS.length)
    expect(SOCIAL_NETWORKS).toHaveLength(8)
  })
})
