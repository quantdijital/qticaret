import type { ContentDoc } from "../../content"
import { DESCRIPTION_TEXT_MAX, descriptionChanges, productDescriptionDoc } from "../description"

const paragraph = (text: string) => ({
  type: "paragraph" as const,
  content: [{ type: "text" as const, text }],
})
const doc = (...content: ContentDoc["content"]): ContentDoc => ({ type: "doc", content })

const messageOf = (value: unknown) =>
  productDescriptionDoc.safeParse(value).error?.issues.map((issue) => issue.message)

describe("a product's description document (adr/0055)", () => {
  it("takes headings, lists, quotes and tables with marks and safe links", () => {
    const written = doc(
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Bakım" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Kılavuz", marks: [{ type: "link", attrs: { href: "/sss" } }] },
        ],
      },
      { type: "blockquote", content: [paragraph("Söz")] },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [{ type: "tableHeader", content: [paragraph("Ölçü")] }],
          },
        ],
      }
    )
    expect(productDescriptionDoc.parse(written)).toEqual(written)
  })

  it("refuses pictures and cards, which are a page's", () => {
    expect(
      messageOf(doc({ type: "image", attrs: { src: "https://cdn.example.com/a.jpg" } }))
    ).toEqual(["catalog.description_blocks"])
    expect(
      messageOf(doc({ type: "categoryCard", attrs: { id: "pcat_01JC0000000000000000000000" } }))
    ).toEqual(["catalog.description_blocks"])
  })

  it("answers with the content keys for a document out of shape or past its bounds", () => {
    expect(messageOf({ type: "doc", content: [{ type: "codeBlock" }] })).toEqual([
      "content.body_invalid",
    ])
    expect(
      messageOf(doc(...Array.from({ length: 4_000 }, () => paragraph("x".repeat(60)))))
    ).toEqual(["content.too_large"])
    const unsafe = doc({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "tık",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    })
    expect(messageOf(unsafe)).toEqual(["content.body_invalid"])
  })
})

describe("what a description save writes (adr/0055)", () => {
  const none = { doc: null, description: null }

  it("keeps a document and writes its plain text when it changes", () => {
    const written = doc(paragraph("Bir"), paragraph("İki"))
    expect(descriptionChanges(written, none)).toEqual({ doc: written, description: "Bir\n\nİki" })
    expect(descriptionChanges(written, { doc: null, description: "Bir\n\nİki" })).toEqual({
      doc: written,
    })
  })

  it("caps the plain text the product keeps", () => {
    const long = doc(...Array.from({ length: 30 }, () => paragraph("y".repeat(1_000))))
    const { description } = descriptionChanges(long, none)
    expect(description?.length).toBeLessThanOrEqual(DESCRIPTION_TEXT_MAX)
  })

  it("clears both for a document without text, and only what is there", () => {
    const empty = doc({ type: "paragraph" })
    expect(descriptionChanges(empty, { doc: doc(paragraph("Eski")), description: "Eski" })).toEqual(
      { doc: null, description: "" }
    )
    expect(descriptionChanges(empty, none)).toEqual({})
  })

  it("drops the document on null and keeps the text; leaves all on undefined", () => {
    const stored = { doc: doc(paragraph("Eski")), description: "Eski" }
    expect(descriptionChanges(null, stored)).toEqual({ doc: null })
    expect(descriptionChanges(null, none)).toEqual({})
    expect(descriptionChanges(undefined, stored)).toEqual({})
  })
})
