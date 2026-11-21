import { acceptedCandidate, acceptedDraft, draftCandidates, draftText } from "../draft-candidates"
import { CAMPAIGN_EMAIL_TASK, PRODUCT_DESCRIPTION_TASK, SEO_TITLE_TASK } from "../registry/tasks"

/**
 * adr/0074 §4 (security review of PR 237, B2): a suggestion's candidates
 * kept one per line and read back the same way, and the accepted one only
 * ever one the suggestion offered.
 */

describe("a draft's candidates", () => {
  it("keeps a short text's candidates one per line and reads them back in order", () => {
    const candidates = ["Birinci başlık", "İkinci başlık", "Üçüncü başlık"]
    const text = draftText(candidates, candidates[0] ?? null)
    expect(text).toBe("Birinci başlık\nİkinci başlık\nÜçüncü başlık")
    expect(draftCandidates(SEO_TITLE_TASK, text)).toEqual(candidates)
    expect(draftCandidates(SEO_TITLE_TASK, draftText(["Tek"], "Tek"))).toEqual(["Tek"])
  })

  it("keeps a one-text task's text whole, line breaks and all", () => {
    const text = "Birinci paragraf.\n\nİkinci paragraf."
    expect(draftText([text], text)).toBe(text)
    expect(draftCandidates(PRODUCT_DESCRIPTION_TASK, text)).toEqual([text])
    expect(draftCandidates(null, text)).toEqual([text])
    expect(draftCandidates(SEO_TITLE_TASK, "")).toEqual([])
  })

  it("accepts only a candidate the suggestion offered, the first when none is named", () => {
    const candidates = ["a", "b", "c"]
    expect(acceptedCandidate(candidates, undefined)).toEqual({ index: 0, text: "a" })
    expect(acceptedCandidate(candidates, 2)).toEqual({ index: 2, text: "c" })
    for (const index of [3, -1, 1.5, Number.NaN, 9]) {
      expect(acceptedCandidate(candidates, index)).toBeNull()
    }
    expect(acceptedCandidate([], undefined)).toBeNull()
  })

  it("takes a bulk e-mail's subject by its place and returns the stored JSON whole", () => {
    const text = JSON.stringify({ subjects: ["a", "b", "c"], preheader: "p", paragraphs: ["x"] })
    expect(acceptedDraft(CAMPAIGN_EMAIL_TASK, text, 2)).toEqual({ index: 2, text })
    expect(acceptedDraft(CAMPAIGN_EMAIL_TASK, text, undefined)).toEqual({ index: 0, text })
    for (const index of [3, -1, 1.5]) {
      expect(acceptedDraft(CAMPAIGN_EMAIL_TASK, text, index)).toBeNull()
    }
    expect(acceptedDraft(CAMPAIGN_EMAIL_TASK, "not json", 0)).toBeNull()
    expect(acceptedDraft(SEO_TITLE_TASK, "a\nb", 1)).toEqual({ index: 1, text: "b" })
  })
})
