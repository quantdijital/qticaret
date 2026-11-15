import { describe, expect, it } from "vitest"
import {
  FAQ_DEFAULTS,
  FAQ_SETTINGS,
  FAQ_SETTING_NAMES,
  faqSettingsOf,
} from "../store/section-faq.js"

describe("the FAQ section's settings (bilesen-denetimi (b) 8)", () => {
  it("names the two switches as off/on steps", () => {
    expect(FAQ_SETTING_NAMES).toEqual(["open_first", "single_open"])
    expect(FAQ_SETTINGS.open_first).toEqual(["off", "on"])
    expect(FAQ_SETTINGS.single_open).toEqual(["off", "on"])
  })

  it("reads a section saved before them as it was drawn: all closed, each on its own", () => {
    expect(FAQ_DEFAULTS).toEqual({ open_first: "off", single_open: "off" })
    expect(faqSettingsOf({})).toEqual(FAQ_DEFAULTS)
    expect(faqSettingsOf({ open_first: "on", single_open: true })).toEqual({
      open_first: "on",
      single_open: "off",
    })
  })
})
