import { describe, expect, it } from "vitest"
import {
  MARQUEE_DEFAULTS,
  MARQUEE_SETTINGS,
  MARQUEE_SETTING_NAMES,
  marqueeSettingsOf,
  marqueeStepOf,
} from "../store/section-marquee.js"

describe("the scrolling strip's settings (adr/0049 Ek 2026-11-14 §4.1)", () => {
  it("names the settings with their steps, motion first, in the panel's order", () => {
    expect(MARQUEE_SETTING_NAMES).toEqual([
      "speed",
      "direction",
      "hover_pause",
      "pause_button",
      "size",
      "ground",
      "separator",
      "weight",
      "uppercase",
      "gap",
      "outline",
      "device",
      "closable",
    ])
    expect(MARQUEE_SETTINGS.speed).toEqual(["slowest", "slow", "medium", "fast", "fastest"])
    expect(MARQUEE_SETTINGS.separator).toEqual(["none", "dot", "star", "line"])
  })

  it("never offers to take the pause button away (WCAG 2.2.2)", () => {
    expect(MARQUEE_SETTINGS.pause_button).toEqual(["always", "hover"])
  })

  it("defaults each setting to one of its own steps", () => {
    for (const name of MARQUEE_SETTING_NAMES) {
      expect(MARQUEE_SETTINGS[name]).toContain(MARQUEE_DEFAULTS[name])
    }
  })

  it("reads a step it knows as it is, and none or an unknown one as the default", () => {
    expect(marqueeStepOf("size", "large")).toBe("large")
    expect(marqueeStepOf("size", "huge")).toBe("medium")
    expect(marqueeStepOf("ground", undefined)).toBe("stage")
    expect(marqueeStepOf("direction", null)).toBe("left")
  })

  it("reads a strip saved before the newer settings as it was drawn then", () => {
    expect(
      marqueeSettingsOf({ speed: "fast", size: "large", ground: "light", separator: "none" })
    ).toEqual({
      ...MARQUEE_DEFAULTS,
      speed: "fast",
      size: "large",
      ground: "light",
      separator: "none",
    })
    expect(marqueeSettingsOf({ gap: "huge", closable: true })).toEqual(MARQUEE_DEFAULTS)
  })
})
