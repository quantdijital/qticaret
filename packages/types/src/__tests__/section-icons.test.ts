import { describe, expect, expectTypeOf, it } from "vitest"
import { CATEGORY_ICONS_DEFAULTS, categoryIconsSettingsOf } from "../store/section-categories.js"
import { SECTION_ICONS, sectionIconOf } from "../store/section-icons.js"
import type { SectionIcon } from "../store/section-icons.js"
import { STATS_DEFAULTS, statsSettingsOf } from "../store/section-stats.js"
import type { TrustIcon } from "../store/storefront.js"
import { TRUST_CARD_DEFAULTS, trustCardSettingsOf } from "../store/section-trust.js"
import { SECTION_VARIANTS } from "../store/section-variants.js"

describe("the sections' icon set (adr/0077 §10 Ek)", () => {
  it("starts with the trust badges' eight, in their order, and names each once", () => {
    expect(SECTION_ICONS.slice(0, 8)).toEqual([
      "truck",
      "clock",
      "shield",
      "card",
      "refresh",
      "award",
      "gift",
      "phone",
    ])
    expect(new Set(SECTION_ICONS).size).toBe(SECTION_ICONS.length)
    expectTypeOf<TrustIcon>().toExtend<SectionIcon>()
  })

  it("reads a listed icon as it is and anything else as none", () => {
    expect(sectionIconOf("mountain")).toBe("mountain")
    expect(sectionIconOf("rocket")).toBeNull()
    expect(sectionIconOf(undefined)).toBeNull()
  })
})

describe("the new variants and settings keep today's drawing by default", () => {
  it("adds the card and the icon row after today's variants", () => {
    expect(SECTION_VARIANTS.trust_badges[0]).toBe("strip")
    expect(SECTION_VARIANTS.trust_badges).toContain("card")
    expect(SECTION_VARIANTS.categories[0]).toBe("tiles")
    expect(SECTION_VARIANTS.categories).toContain("icons")
  })

  it("leaves the card unlifted and reads an unknown lift as off", () => {
    expect(TRUST_CARD_DEFAULTS).toEqual({ lift: "off" })
    expect(trustCardSettingsOf({})).toEqual({ lift: "off" })
    expect(trustCardSettingsOf({ lift: "on" })).toEqual({ lift: "on" })
    expect(trustCardSettingsOf({ lift: "high" })).toEqual({ lift: "off" })
  })

  it("draws the figures without icons unless the shop turns them on", () => {
    expect(STATS_DEFAULTS).toEqual({ dividers: "on", icons: "off" })
    expect(statsSettingsOf({ dividers: "off" })).toEqual({ dividers: "off", icons: "off" })
    expect(statsSettingsOf({ icons: "on" })).toEqual({ dividers: "on", icons: "on" })
    expect(statsSettingsOf({ icons: "big" })).toEqual(STATS_DEFAULTS)
  })

  it("reads the icon row's settings forgivingly", () => {
    expect(CATEGORY_ICONS_DEFAULTS).toEqual({ disc: "tint", phone: "scroll" })
    expect(categoryIconsSettingsOf({ disc: "line", phone: "wrap" })).toEqual({
      disc: "line",
      phone: "wrap",
    })
    expect(categoryIconsSettingsOf({ disc: "gold" })).toEqual(CATEGORY_ICONS_DEFAULTS)
  })
})
