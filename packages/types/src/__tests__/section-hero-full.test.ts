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

  it("keeps the blended photograph, both actions and the drawn marks", () => {
    expect(
      heroFullSettingsOf({
        action: "both",
        image_side: "blend",
        button_tone: "accent",
        button_icon: "arrow",
        accent_mark: "swash",
        ornament: "leaves",
      })
    ).toEqual({
      ...HERO_FULL_DEFAULTS,
      action: "both",
      image_side: "blend",
      button_tone: "accent",
      button_icon: "arrow",
      accent_mark: "swash",
      ornament: "leaves",
    })
    expect(heroFullStepOf("button_tone", "orange")).toBe("primary")
    expect(heroFullStepOf("ornament", undefined)).toBe("none")
  })

  it("keeps the play button, stacked title, inside trust row, corner note and side scrim", () => {
    expect(HERO_FULL_DEFAULTS).toMatchObject({
      second_button: "quiet",
      title_style: "standard",
      trust_place: "foot",
      note_place: "heading",
    })
    expect(
      heroFullSettingsOf({
        second_button: "play",
        title_style: "stacked",
        trust_place: "inside",
        note_place: "corner",
        scrim: "side",
      })
    ).toEqual({
      ...HERO_FULL_DEFAULTS,
      second_button: "play",
      title_style: "stacked",
      trust_place: "inside",
      note_place: "corner",
      scrim: "side",
    })
    expect(heroFullStepOf("second_button", "video")).toBe("quiet")
    expect(heroFullStepOf("note_place", 3)).toBe("heading")
  })
})
