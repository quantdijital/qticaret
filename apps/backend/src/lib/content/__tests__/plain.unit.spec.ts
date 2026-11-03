import type { ContentDoc } from "../doc"
import { docPlainText, hasText } from "../plain"

const text = (value: string) => ({ type: "text" as const, text: value })
const paragraph = (...values: string[]) => ({
  type: "paragraph" as const,
  content: values.map(text),
})
const item = (...values: string[]) => ({
  type: "listItem" as const,
  content: [paragraph(...values)],
})
const cell = (type: "tableCell" | "tableHeader", value: string) => ({
  type,
  content: value === "" ? [{ type: "paragraph" as const }] : [paragraph(value)],
})

describe("a document's plain text (adr/0055)", () => {
  it("puts blocks apart by a blank line, list items and table rows a line each", () => {
    const doc: ContentDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [text("Özellikler")] },
        paragraph("Ağır ", "gövde."),
        {
          type: "bulletList",
          content: [
            item("Döküm"),
            {
              type: "listItem",
              content: [
                paragraph("Boyutlar"),
                { type: "orderedList", content: [item("24 cm"), item("28 cm")] },
              ],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [cell("tableHeader", "Ölçü"), cell("tableCell", "28 cm")],
            },
            {
              type: "tableRow",
              content: [
                cell("tableHeader", "Renk"),
                cell("tableCell", ""),
                cell("tableCell", "Mavi"),
              ],
            },
          ],
        },
        { type: "blockquote", content: [paragraph("Bir alıntı"), paragraph("iki paragraf")] },
      ],
    }
    expect(docPlainText(doc, 20_000)).toEqual({
      text: [
        "Özellikler",
        "Ağır gövde.",
        "Döküm\nBoyutlar\n24 cm\n28 cm",
        "Ölçü · 28 cm\nRenk · Mavi",
        "Bir alıntı",
        "iki paragraf",
      ].join("\n\n"),
      cut: false,
    })
  })

  it("keeps a line break in a paragraph, and its runs of spaces as one", () => {
    const doc: ContentDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("  Birinci   satır "), { type: "hardBreak" }, text("ikinci")],
        },
      ],
    }
    expect(docPlainText(doc, 100).text).toBe("Birinci satır\nikinci")
  })

  it("says nothing for pictures, cards and empty paragraphs", () => {
    const doc: ContentDoc = {
      type: "doc",
      content: [
        { type: "paragraph" },
        { type: "image", attrs: { src: "https://cdn.example.com/a.jpg", alt: "A" } },
        { type: "productCard", attrs: { id: "prod_01JC0000000000000000000000" } },
        paragraph("Metin"),
      ],
    }
    expect(docPlainText(doc, 100).text).toBe("Metin")
    expect(hasText({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false)
    expect(hasText(doc)).toBe(true)
  })

  it("is cut at a block within its cap, a first block too long at a word", () => {
    const doc: ContentDoc = {
      type: "doc",
      content: [paragraph("bir iki üç"), paragraph("dört beş altı")],
    }
    expect(docPlainText(doc, 15)).toEqual({ text: "bir iki üç", cut: true })
    expect(docPlainText(doc, 8)).toEqual({ text: "bir iki", cut: true })
    expect(docPlainText(doc, 25)).toEqual({ text: "bir iki üç\n\ndört beş altı", cut: false })
  })
})
