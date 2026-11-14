import { describe, expect, it } from "vitest"
import {
  MARQUEE_DEFAULTS,
  MARQUEE_SETTINGS,
  MARQUEE_SETTING_NAMES,
  marqueeStepOf,
} from "../store/section-marquee.js"

describe("the scrolling strip's settings (adr/0049 Ek 2026-11-14 §4.1)", () => {
  it("names the five settings with their steps, in the panel's order", () => {
    expect(MARQUEE_SETTING_NAMES).toEqual(["speed", "direction", "ground", "size", "separator"])
    expect(MARQUEE_SETTINGS.separator).toEqual(["none", "dot", "star", "line"])
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
})
