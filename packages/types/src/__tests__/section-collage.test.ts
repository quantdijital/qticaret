import { describe, expect, it } from "vitest"
import {
  PHOTO_COLLAGE_DEFAULTS,
  PHOTO_COLLAGE_LIMITS,
  PHOTO_COLLAGE_SETTINGS,
  photoCollageSettingsOf,
} from "../store/section-collage.js"

describe("the photo collage's contract (adr/0077 §10)", () => {
  it("lists the uneven collage and the phone's row first, the defaults", () => {
    expect(PHOTO_COLLAGE_SETTINGS.layout[0]).toBe(PHOTO_COLLAGE_DEFAULTS.layout)
    expect(PHOTO_COLLAGE_SETTINGS.phone[0]).toBe(PHOTO_COLLAGE_DEFAULTS.phone)
    expect(PHOTO_COLLAGE_LIMITS.items).toEqual({ min: 3, max: 7 })
  })

  it("reads a missing or unknown step as its default, a listed one as it is", () => {
    expect(photoCollageSettingsOf({})).toEqual(PHOTO_COLLAGE_DEFAULTS)
    expect(photoCollageSettingsOf({ layout: "bento", phone: "stack" })).toEqual({
      layout: "asymmetric",
      phone: "stack",
      card: "over",
      height: "standard",
    })
    expect(photoCollageSettingsOf({ layout: "even" }).layout).toBe("even")
  })
})
