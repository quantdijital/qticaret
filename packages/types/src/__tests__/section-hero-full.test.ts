import { describe, expect, it } from "vitest"
import {
  HERO_FULL_DEFAULTS,
  HERO_FULL_SETTINGS,
  heroFullSettingsOf,
  heroFullStepOf,
} from "../store/section-hero-full.js"
import type { HeroFullSetting } from "../store/section-hero-full.js"
import { variantOf } from "../store/section-variants.js"

// adr/0077 §9: the opening's full image
describe("the full image opening's settings", () => {
  it("is a variant of the opening a reader knows", () => {
    expect(variantOf("hero", "full_image")).toBe("full_image")
  })

  it("names each setting's default first on its list", () => {
    for (const name of Object.keys(HERO_FULL_SETTINGS) as HeroFullSetting[]) {
      expect(HERO_FULL_DEFAULTS[name]).toBe(HERO_FULL_SETTINGS[name][0])
    }
  })

  it("reads a section that names nothing as the defaults", () => {
    expect(heroFullSettingsOf({})).toEqual(HERO_FULL_DEFAULTS)
  })

  it("keeps a listed step and reads one off its list as the default", () => {
    expect(heroFullStepOf("edge", "wave")).toBe("wave")
    expect(heroFullStepOf("edge", "zigzag")).toBe("straight")
    expect(heroFullStepOf("action", null)).toBe("button")
    expect(
      heroFullSettingsOf({ action: "search", search_position: "overlap", height: 3, scrim: "max" })
    ).toEqual({ ...HERO_FULL_DEFAULTS, action: "search", search_position: "overlap" })
  })
})
