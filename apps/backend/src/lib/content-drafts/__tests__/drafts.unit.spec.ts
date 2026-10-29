import { draftProblems } from "../gate"
import { draftFacts, draftPrompt } from "../prompts"
import type { ProductDraftFacts } from "../prompts"
import { fakeDraftProvider } from "../provider"
import { hasPersonalData, redactPersonalData } from "../redact"

const FACTS: ProductDraftFacts = {
  name: "Keten Gömlek",
  subtitle: null,
  brand: "Örnek",
  category: "Gömlekler",
  attributes: [{ label: "Malzeme", value: "Keten" }],
  description:
    "Yazlık gömlek. Bilgi için ayse.yilmaz@example.com ya da 0532 123 45 67; havale TR33 0006 1005 1978 6457 8413 26, TC 12345678901, kart 4111 1111 1111 1111.",
  shopName: "Demo Mağaza",
}

describe("content drafts (F10.13, adr/0005)", () => {
  it("takes what reads as a person's data out of the text (KK8)", () => {
    const clean = redactPersonalData(FACTS.description ?? "")

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

  it("asks with the product's facts only, filtered (KK8)", () => {
    const prompt = draftPrompt("product_description", FACTS)

    expect(prompt).toContain("Ad: Keten Gömlek")
    expect(prompt).toContain("Malzeme: Keten")
    expect(hasPersonalData(prompt)).toBe(false)
  })

  it("filters the facts a provider gets too: labels, and a number at the edge of the clip", () => {
    const facts = draftFacts({
      ...FACTS,
      attributes: [{ label: "İletişim ayse.yilmaz@example.com", value: "Keten" }],
      // The phone straddles the 2,000th character: filtered whole before the cut
      description: `${"a ".repeat(996)}0532 123 45 67 sonra`,
    })

    expect(JSON.stringify(facts)).not.toContain("ayse.yilmaz@example.com")
    expect(facts.description).not.toMatch(/0532|123 45/)
    expect(hasPersonalData(JSON.stringify(facts))).toBe(false)
  })

  it("offers a draft only when the advisor's rules for its field pass", () => {
    expect(draftProblems("seo_title", "Keten Gömlek | Demo Mağaza yazlık koleksiyon")).toEqual([])
    expect(draftProblems("seo_title", "KISA")).toEqual(["length"])
    expect(draftProblems("seo_title", "KETEN GÖMLEK ŞİMDİ EN UCUZ FİYATLA BURADA!!")).toContain(
      "noise"
    )
    expect(draftProblems("seo_description", "Kısa bir açıklama ama çok kısa.")).toEqual(["length"])
    expect(draftProblems("product_description", "Yalnızca birkaç kelime.")).toEqual(["too_short"])
    expect(
      draftProblems(
        "seo_description",
        `${"Keten gömlek yazlık ve rahat. ".repeat(2)}Ara: 0532 123 45 67 hemen`
      )
    ).toContain("personal_data")
  })

  it("has the fake write drafts that pass the rules", async () => {
    for (const kind of ["product_description", "seo_title", "seo_description"] as const) {
      const text = await fakeDraftProvider.draft({
        kind,
        prompt: draftPrompt(kind, FACTS),
        facts: FACTS,
      })

      expect(draftProblems(kind, text)).toEqual([])
    }
  })
})
