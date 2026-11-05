import { productSummary, summaryOf, summaryText } from "../summary"
import { productText, shortDescription } from "../../seo/product-text"

const LINES = ["N690 çelik, 58-59 HRC", "Geyik boynuzu sap", "Sırttan kilitli", "2 yıl garanti"]

const refusal = (value: unknown) => {
  const parsed = productSummary.safeParse(value)
  return parsed.success ? null : parsed.error.issues[0]?.message
}

describe("a product's short description (adr/0055 Ek 2026-11-05)", () => {
  it("keeps a save's lines tidied, empty ones dropped", () => {
    expect(productSummary.parse(["  N690   çelik ", "", "\t", "2 yıl\ngaranti"])).toEqual([
      "N690 çelik",
      "2 yıl garanti",
    ])
    expect(productSummary.parse([])).toEqual([])
  })

  it("refuses more than five lines, a line past 90 characters and hidden characters", () => {
    expect(refusal(["a", "b", "c", "d", "e", "f"])).toBe("catalog.summary_too_many")
    // Six sent, one of them empty: five kept
    expect(refusal(["a", "b", "", "c", "d", "e"])).toBeNull()
    expect(refusal(["x".repeat(91)])).toBe("catalog.summary_too_long")
    expect(refusal(["x".repeat(90)])).toBeNull()
    expect(refusal(["gizli​metin"])).toBe("catalog.summary_invalid")
    expect(refusal(["bell\u0007"])).toBe("catalog.summary_invalid")
    expect(refusal("tek satır")).not.toBeNull()
  })

  it("reads a stored value defensively", () => {
    expect(summaryOf(null)).toEqual([])
    expect(summaryOf("metin")).toEqual([])
    expect(summaryOf([" a ", 3, "", "b", "c", "d", "e", "f"])).toEqual(["a", "b", "c", "d", "e"])
  })

  it("says the lines as sentences, whole lines within a length", () => {
    expect(summaryText(LINES)).toBe(
      "N690 çelik, 58-59 HRC. Geyik boynuzu sap. Sırttan kilitli. 2 yıl garanti."
    )
    expect(summaryText(["Paslanmaz.", "Hafif!", "Bulaşık makinesinde yıkanır;"])).toBe(
      "Paslanmaz. Hafif! Bulaşık makinesinde yıkanır."
    )
    expect(summaryText(LINES, 45)).toBe("N690 çelik, 58-59 HRC. Geyik boynuzu sap.")
    // A first line longer than the room is cut at a word
    expect(summaryText(["Uzun bir satır ki sığmaz burada"], 20)).toBe("Uzun bir satır ki")
    expect(summaryText([])).toBe("")
  })

  it("fills the kısa_açıklama token before the subtitle and the description", () => {
    expect(shortDescription(LINES, "Alt başlık", "Uzun açıklama.")).toBe(
      "N690 çelik, 58-59 HRC. Geyik boynuzu sap. Sırttan kilitli. 2 yıl garanti"
    )
    expect(shortDescription([], "Alt başlık", "Uzun açıklama.")).toBe("Alt başlık")
    expect(shortDescription([], "", "<p>Uzun açıklama.</p>")).toBe("Uzun açıklama.")
  })

  it("stands in for an empty description in JSON-LD and feeds", () => {
    expect(productText("<p>Kendi metni</p>", LINES)).toBe("Kendi metni")
    expect(productText("  ", LINES)).toBe(summaryText(LINES))
    expect(productText("", [])).toBe("")
  })
})
