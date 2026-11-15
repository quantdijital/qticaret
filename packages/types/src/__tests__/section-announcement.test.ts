import { describe, expect, it } from "vitest"
import {
  ANNOUNCEMENT_DEFAULTS,
  ANNOUNCEMENT_SETTINGS,
  ANNOUNCEMENT_SETTING_NAMES,
  announcementSettingsOf,
} from "../store/section-announcement.js"

describe("the announcement bar's settings (bilesen-denetimi (b) 6)", () => {
  it("names the settings with their steps, the way it shows several lines first", () => {
    expect(ANNOUNCEMENT_SETTING_NAMES).toEqual(["mode", "interval", "pause_button", "hover_pause"])
    expect(ANNOUNCEMENT_SETTINGS.mode).toEqual(["first", "rotate", "inline"])
    expect(ANNOUNCEMENT_SETTINGS.interval).toEqual(["slow", "medium", "fast"])
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
    for (const name of ANNOUNCEMENT_SETTING_NAMES) {
      expect(ANNOUNCEMENT_SETTINGS[name]).toContain(ANNOUNCEMENT_DEFAULTS[name])
    }
  })
})
