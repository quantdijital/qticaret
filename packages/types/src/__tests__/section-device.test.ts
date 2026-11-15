import { describe, expect, it } from "vitest"
import { SECTION_DEVICES, SECTION_DEVICE_DEFAULT, deviceOf } from "../store/section-device.js"
import { MARQUEE_SETTINGS } from "../store/section-marquee.js"

describe("which screens show a section (docs/tema/bilesen-standardi §2, O1)", () => {
  it("offers everywhere, phones only and wide screens only; everywhere by default", () => {
    expect(SECTION_DEVICES).toEqual(["all", "mobile", "desktop"])
    expect(SECTION_DEVICE_DEFAULT).toBe("all")
  })

  it("reads a strip's saved step as it is, none or an unknown one as everywhere", () => {
    expect(deviceOf("mobile")).toBe("mobile")
    expect(deviceOf("desktop")).toBe("desktop")
    expect(deviceOf(undefined)).toBe("all")
    expect(deviceOf("tablet")).toBe("all")
  })

  it("is no longer the strip's own setting", () => {
    expect(Object.keys(MARQUEE_SETTINGS)).not.toContain("device")
  })
})
