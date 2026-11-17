import { isValidationError } from "../../../errors"
import { cleanVideoTitle } from "../receive"

const refusal = (value: string) => {
  try {
    cleanVideoTitle(value)
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : "other"
  }
  return null
}

/** A video's title (adr/0069 §1; the upload and the title route take it alike). */
describe("a video's title", () => {
  it("is trimmed, and empty is none", () => {
    expect(cleanVideoTitle("  Yakın çekim  ")).toBe("Yakın çekim")
    expect(cleanVideoTitle("   ")).toBeNull()
    // Turkish letters, emoji and punctuation are a title's
    expect(cleanVideoTitle("Şef bıçağı – ön ve arka 🔪")).toBe("Şef bıçağı – ön ve arka 🔪")
  })

  it("refuses more than 200 characters, controls and line breaks", () => {
    expect(cleanVideoTitle("a".repeat(200))).toHaveLength(200)
    for (const value of ["a".repeat(201), "a\nb", "a\tb", "a\u0085b", "a b", "a b"]) {
      expect(refusal(value)).toBe("video.title_invalid")
    }
  })

  it("refuses format characters: bidi overrides, zero-width ones and the BOM (review L1)", () => {
    for (const char of [
      "‮", // right-to-left override
      "‭", // left-to-right override
      "⁦", // left-to-right isolate
      "⁩", // pop directional isolate
      "​", // zero-width space
      "‍", // zero-width joiner
      "‎", // left-to-right mark
      "﻿", // byte order mark
      "­", // soft hyphen
    ]) {
      expect(refusal(`Yakın${char}çekim`)).toBe("video.title_invalid")
    }
  })
})
