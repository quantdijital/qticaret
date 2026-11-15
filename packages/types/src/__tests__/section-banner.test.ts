import { describe, expect, it } from "vitest"
import {
  BANNER_DEFAULTS,
  BANNER_SETTINGS,
  BANNER_SETTING_NAMES,
  bannerStepOf,
  bannerToneOf,
} from "../store/section-banner.js"

describe("the picture band's settings (adr/0049 Ek 2026-11-14 §3.3 E2)", () => {
  it("names the five settings with their steps, in the panel's order", () => {
    expect(BANNER_SETTING_NAMES).toEqual([
      "width",
      "height",
      "text_position",
      "overlay",
      "button_style",
    ])
    expect(BANNER_SETTINGS.text_position).toHaveLength(9)
    expect(BANNER_SETTINGS.overlay).toEqual(["none", "light", "medium", "strong"])
  })

  it("defaults each setting to one of its own steps: the band as drawn before them", () => {
    for (const name of BANNER_SETTING_NAMES) {
      expect(BANNER_SETTINGS[name]).toContain(BANNER_DEFAULTS[name])
    }
    expect(BANNER_DEFAULTS).toEqual({
      width: "boxed",
      height: "medium",
      text_position: "bottom_left",
      overlay: "medium",
      button_style: "solid",
    })
  })

  it("reads a step it knows as it is, and none or an unknown one as the default", () => {
    expect(bannerStepOf("overlay", "none")).toBe("none")
    expect(bannerStepOf("overlay", "max")).toBe("medium")
    expect(bannerStepOf("width", undefined)).toBe("boxed")
    expect(bannerToneOf("dark")).toBe("dark")
    expect(bannerToneOf("grey")).toBe("light")
    expect(bannerToneOf(undefined)).toBe("light")
  })
})
