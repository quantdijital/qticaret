import { describe, expect, it } from "vitest"
import { docOfDescription, docOfParagraphs } from "./description-doc"

describe("docOfDescription (ADR-0055)", () => {
  it("makes each paragraph of a plain description a paragraph, a line break a hard break", () => {
    expect(docOfDescription("İlk paragraf.\r\n\r\nİkinci satır\n  devamı  \n\n\n\nSon.")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "İlk paragraf." }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "İkinci satır" },
            { type: "hardBreak" },
            { type: "text", text: "devamı" },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Son." }] },
      ],
    })
  })

  it("reads no text, blank lines and whitespace as an empty document", () => {
    for (const text of [null, undefined, "", "  \n \n\t\n"]) {
      expect(docOfDescription(text)).toEqual({ type: "doc", content: [] })
    }
  })
})

describe("docOfParagraphs (adr/0071 §9)", () => {
  it("makes every line of an AI suggestion a plain paragraph, no hard breaks, no marks", () => {
    expect(docOfParagraphs("İlk paragraf.\r\nİkinci  \n\n  Üçüncü *yıldızlı*.")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "İlk paragraf." }] },
        { type: "paragraph", content: [{ type: "text", text: "İkinci" }] },
        { type: "paragraph", content: [{ type: "text", text: "Üçüncü *yıldızlı*." }] },
      ],
    })
    expect(docOfParagraphs("")).toEqual({ type: "doc", content: [] })
  })
})
