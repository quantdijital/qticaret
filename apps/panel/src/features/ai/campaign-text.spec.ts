import { describe, expect, it } from "vitest"
import { readCampaignEmail, withDraftBody } from "./campaign-text"

/** A bulk e-mail's suggestion read again in the panel; the body's words replace, its cards stay. */

describe("an e-mail suggestion", () => {
  it("reads its subjects, preview line and paragraphs", () => {
    const text = JSON.stringify({
      subjects: ["Kış seçkisi", "", 3, "Yün atkılar"],
      preheader: " ",
      paragraphs: ["Kış koleksiyonumuz raflarda."],
    })
    expect(readCampaignEmail(text)).toEqual({
      subjects: ["Kış seçkisi", "Yün atkılar"],
      preheader: null,
      paragraphs: ["Kış koleksiyonumuz raflarda."],
    })
  })

  it("is null for any other text", () => {
    expect(readCampaignEmail("Kış seçkisi")).toBeNull()
    expect(readCampaignEmail("[]")).toBeNull()
    expect(readCampaignEmail(JSON.stringify({ subjects: ["a"], paragraphs: [] }))).toBeNull()
  })
})

describe("the body with the draft's words", () => {
  it("puts plain paragraphs first and keeps the pictures and cards, in order", () => {
    const image = { type: "image", attrs: { src: "/m/1.webp" } }
    const card = { type: "productCard", attrs: { id: "prod_1" } }
    const old = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Eski." }] }, image, card],
    }
    expect(withDraftBody(old, ["<b>Yeni</b> metin."])).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "<b>Yeni</b> metin." }] },
        image,
        card,
      ],
    })
    expect(withDraftBody(null, ["Tek."]).content).toHaveLength(1)
  })
})
