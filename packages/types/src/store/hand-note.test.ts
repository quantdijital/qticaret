import { describe, expect, it } from "vitest"
import { ACCENT_FONTS, HAND_NOTE_MAX, accentFontOf, handNoteOf } from "./hand-note.js"

describe("the hand note's contract", () => {
  it("offers no face first, then a few handwriting faces", () => {
    expect(ACCENT_FONTS[0]).toBe("none")
    expect(ACCENT_FONTS).toEqual(["none", "caveat", "dancing-script", "kalam"])
    expect(HAND_NOTE_MAX).toBe(60)
  })

  it("reads an accent face it does not know, or none, as none", () => {
    expect(accentFontOf("caveat")).toBe("caveat")
    expect(accentFontOf("kalam")).toBe("kalam")
    for (const value of [undefined, null, "", "comic-sans", "https://fonts.example/x.woff2", 3]) {
      expect(accentFontOf(value)).toBe("none")
    }
  })

  it("reads a note's words trimmed, and nothing as null", () => {
    expect(handNoteOf("  Sizi bekliyoruz!  ")).toBe("Sizi bekliyoruz!")
    for (const value of [undefined, null, "", "   ", 42, {}]) {
      expect(handNoteOf(value)).toBeNull()
    }
  })
})
