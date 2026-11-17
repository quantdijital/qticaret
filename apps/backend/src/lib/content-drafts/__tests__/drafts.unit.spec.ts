import { fieldProblems } from "../../ai/field-rules"
import { hasPersonalData } from "../../ai/redact"
import { draftFacts, draftPrompt } from "../prompts"
import type { ProductDraftFacts } from "../prompts"
import { fakeDraftProvider } from "../provider"

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

// The filter and the field rules moved to lib/ai (docs/22 PR 2-1): tested in lib/ai/__tests__/field-rules.unit.spec.ts
describe("content drafts (F10.13, adr/0005)", () => {
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

  it("has the fake write drafts that pass the rules", async () => {
    for (const kind of ["product_description", "seo_title", "seo_description"] as const) {
      const text = await fakeDraftProvider.draft({
        kind,
        prompt: draftPrompt(kind, FACTS),
        facts: FACTS,
      })

      expect(fieldProblems(kind, text)).toEqual([])
    }
  })
})
