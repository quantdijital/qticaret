import { describe, expect, it } from "vitest"
import {
  FAQ_DEFAULTS,
  FAQ_SETTINGS,
  FAQ_SETTING_NAMES,
  faqOffPages,
  faqSettingsOf,
  isFaqHeading,
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

  // adr/0073 Ek 2026-11-24 (2): the questions page is a content page's only; a row a heading or a question
  it("keeps the questions page to content pages and tells a heading row", () => {
    expect(faqOffPages("standard")).toBe(true)
    expect(faqOffPages("page")).toBe(false)
    expect(isFaqHeading({ heading: "Kargo" })).toBe(true)
    expect(isFaqHeading({ question: "Ne zaman?", html: "<p>Yarın.</p>" })).toBe(false)
  })
})
