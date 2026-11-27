import { describe, expect, it } from "vitest"
import {
  ANNOUNCEMENT_DEFAULTS,
  ANNOUNCEMENT_SETTINGS,
  ANNOUNCEMENT_SETTING_NAMES,
  announcementSettingsOf,
} from "../store/section-announcement.js"

describe("the announcement bar's settings (bilesen-denetimi (b) 6)", () => {
  it("names the settings with their steps, the way it shows several lines first", () => {
    expect(ANNOUNCEMENT_SETTING_NAMES).toEqual([
      "mode",
      "interval",
      "pause_button",
      "hover_pause",
      "align",
      "size",
      "tone",
      "transition",
      "arrows",
    ])
    expect(ANNOUNCEMENT_SETTINGS.mode).toEqual(["first", "rotate", "inline"])
    expect(ANNOUNCEMENT_SETTINGS.interval).toEqual(["slow", "medium", "fast"])
    expect(ANNOUNCEMENT_SETTINGS.align).toEqual(["auto", "left", "center", "right"])
    expect(ANNOUNCEMENT_SETTINGS.size).toEqual(["small", "medium", "large"])
  })

  it("turns like a slider only when asked: fading in place, no arrows, as before", () => {
    expect(ANNOUNCEMENT_SETTINGS.transition).toEqual(["fade", "slide"])
    expect(ANNOUNCEMENT_SETTINGS.arrows).toEqual(["off", "on"])
    expect(ANNOUNCEMENT_DEFAULTS).toMatchObject({ transition: "fade", arrows: "off" })
    expect(announcementSettingsOf({ transition: "spin", arrows: "on" })).toMatchObject({
      transition: "fade",
      arrows: "on",
    })
  })

  it("never offers to take the pause button away (WCAG 2.2.2)", () => {
    expect(ANNOUNCEMENT_SETTINGS.pause_button).toEqual(["always", "hover"])
  })

  it("reads a bar saved before the settings as it was drawn: the first line alone", () => {
    expect(ANNOUNCEMENT_DEFAULTS.mode).toBe("first")
    expect(announcementSettingsOf({})).toEqual(ANNOUNCEMENT_DEFAULTS)
    expect(announcementSettingsOf({ mode: "rotate", interval: "warp" })).toEqual({
      ...ANNOUNCEMENT_DEFAULTS,
      mode: "rotate",
    })
    // Where the lines sit and the bar's size as before: centred on a phone, at the start wide
    expect(ANNOUNCEMENT_DEFAULTS.align).toBe("auto")
    expect(ANNOUNCEMENT_DEFAULTS.size).toBe("medium")
    expect(announcementSettingsOf({ align: "middle", size: "large" })).toEqual({
      ...ANNOUNCEMENT_DEFAULTS,
      size: "large",
    })
    for (const name of ANNOUNCEMENT_SETTING_NAMES) {
      expect(ANNOUNCEMENT_SETTINGS[name]).toContain(ANNOUNCEMENT_DEFAULTS[name])
    }
  })
})
