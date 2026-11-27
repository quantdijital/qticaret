import { describe, expect, it } from "vitest"
import {
  TOP_SLIDER_DEFAULTS,
  TOP_SLIDER_SETTINGS,
  topSliderSettingsOf,
} from "../store/section-top-slider.js"

describe("the top image slider's settings (owner 2026-11-27)", () => {
  it("reads one missing or unknown as its default, a thin sliding band with arrows", () => {
    expect(topSliderSettingsOf({})).toEqual(TOP_SLIDER_DEFAULTS)
    expect(TOP_SLIDER_DEFAULTS).toEqual({
      height: "thin",
      interval: "medium",
      transition: "slide",
      arrows: "on",
      dots: "off",
    })
    expect(topSliderSettingsOf({ height: "huge", dots: "on" })).toEqual({
      ...TOP_SLIDER_DEFAULTS,
      dots: "on",
    })
    expect(TOP_SLIDER_SETTINGS.interval).toEqual(["slow", "medium", "fast"])
  })
})
