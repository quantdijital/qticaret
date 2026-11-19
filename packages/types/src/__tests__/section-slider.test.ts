import { describe, expect, it } from "vitest"
import {
  SCROLLER_SETTINGS,
  SLIDER_DEFAULTS,
  SLIDER_SCROLLER,
  SLIDER_SECONDS,
  sliderSecondsOf,
  sliderSettingsOf,
  sliderSpeedOf,
} from "../store/section-scroller.js"

describe("the hero slider's kit settings (bilesen-denetimi (b) 4)", () => {
  it("takes the kit's settings a slider has use for, each default on the kit's list", () => {
    expect(SLIDER_SCROLLER).toEqual([
      "autoplay",
      "speed",
      "loop",
      "arrows",
      "arrow_style",
      "dots",
      "play_button",
      "dot_style",
      "controls_place",
      "arrow_size",
      "controls_tone",
    ])
    for (const name of SLIDER_SCROLLER) {
      expect(SCROLLER_SETTINGS[name]).toContain(SLIDER_DEFAULTS[name])
    }
    // The slider's look before the kit: still, looping, dots and round arrows showing
    expect(SLIDER_DEFAULTS).toEqual({
      autoplay: "off",
      speed: "medium",
      loop: "on",
      arrows: "always",
      arrow_style: "round",
      dots: "on",
      // The controls as they were drawn: a pause button, dots in the middle, graphite, 48 px arrows
      play_button: "on",
      dot_style: "dots",
      controls_place: "center",
      arrow_size: "medium",
      controls_tone: "dark",
    })
  })

  it("reads saved seconds as the nearest step, and the switches from before the kit", () => {
    expect([5, 6, 7, 8, 9, 10].map(sliderSpeedOf)).toEqual([
      "fast",
      "medium",
      "medium",
      "slow",
      "slow",
      "slow",
    ])
    expect(sliderSettingsOf({})).toEqual(SLIDER_DEFAULTS)
    expect(sliderSettingsOf({ autoplay: true, interval: 5, dots: false, arrows: false })).toEqual({
      ...SLIDER_DEFAULTS,
      autoplay: "on",
      speed: "fast",
      dots: "off",
      arrows: "hidden",
    })
    // The kit's own settings win; a step off its list reads as the slider's default
    expect(sliderSettingsOf({ scroller: { loop: "off", arrows: "soon" }, dots: false })).toEqual({
      ...SLIDER_DEFAULTS,
      loop: "off",
    })
  })

  it("plays seconds no step keeps while they stand for the speed in force", () => {
    expect(SLIDER_SECONDS).toEqual({ fast: 5, medium: 6, slow: 8 })
    const medium = { ...SLIDER_DEFAULTS, speed: "medium" as const }
    expect(sliderSecondsOf({ interval: 7 }, medium)).toBe(7)
    expect(sliderSecondsOf({ interval: 9 }, medium)).toBe(6)
    expect(sliderSecondsOf({ interval: 12 }, { ...medium, speed: "slow" })).toBe(8)
    expect(sliderSecondsOf({}, { ...medium, speed: "fast" })).toBe(5)
  })
})
