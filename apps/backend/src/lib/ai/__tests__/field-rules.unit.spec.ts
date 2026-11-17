import { fieldProblems } from "../field-rules"
import { hasPersonalData, redactPersonalData } from "../redact"

/**
 * adr/0005's personal data filter and field rules, moved from
 * `lib/content-drafts` to the AI core (docs/22 PR 2-1): the same patterns
 * and the same rules, now shared by the core's gate and the old draft
 * routes until PR 2-2 removes those.
 */

const PASTED =
  "Yazlık gömlek. Bilgi için ayse.yilmaz@example.com ya da 0532 123 45 67; havale TR33 0006 1005 1978 6457 8413 26, TC 12345678901, kart 4111 1111 1111 1111."

describe("personal data filter (adr/0005 KK8, adr/0071 §10)", () => {
  it("takes what reads as a person's data out of the text", () => {
    const clean = redactPersonalData(PASTED)

    for (const personal of [
      "ayse.yilmaz@example.com",
      "0532 123 45 67",
      "TR33 0006 1005 1978 6457 8413 26",
      "12345678901",
      "4111 1111 1111 1111",
    ]) {
      expect(clean).not.toContain(personal)
    }
    expect(clean).toContain("Yazlık gömlek.")
    expect(hasPersonalData(clean)).toBe(false)
    // A product's own numbers stay: sizes, years, prices
    expect(redactPersonalData("42 numara, 2026 sezonu, 899,90 TL")).toBe(
      "42 numara, 2026 sezonu, 899,90 TL"
    )
  })
})

describe("field rules (adr/0005: a low score is not offered)", () => {
  it("holds a text to the advisor's rules for its field", () => {
    expect(fieldProblems("seo_title", "Keten Gömlek | Demo Mağaza yazlık koleksiyon")).toEqual([])
    expect(fieldProblems("seo_title", "KISA")).toEqual(["length"])
    expect(fieldProblems("seo_title", "KETEN GÖMLEK ŞİMDİ EN UCUZ FİYATLA BURADA!!")).toContain(
      "noise"
    )
    expect(fieldProblems("seo_description", "Kısa bir açıklama ama çok kısa.")).toEqual(["length"])
    expect(fieldProblems("product_description", "Yalnızca birkaç kelime.")).toEqual(["too_short"])
    expect(
      fieldProblems(
        "seo_description",
        `${"Keten gömlek yazlık ve rahat. ".repeat(2)}Ara: 0532 123 45 67 hemen`
      )
    ).toContain("personal_data")
  })
})
