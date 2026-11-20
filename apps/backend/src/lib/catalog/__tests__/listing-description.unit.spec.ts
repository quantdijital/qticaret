import type { ContentDoc } from "../../content"
import {
  listingDescriptionChanges,
  listingDescriptionDoc,
  listingDescriptionHtml,
  storedListingDoc,
} from "../listing-description"

const paragraph = (text: string) => ({
  type: "paragraph" as const,
  content: [{ type: "text" as const, text }],
})
const heading = (level: 2 | 3 | 4, text: string) => ({
  type: "heading" as const,
  attrs: { level },
  content: [{ type: "text" as const, text }],
})
const doc = (...content: ContentDoc["content"]): ContentDoc => ({ type: "doc", content })

const messagesOf = (value: unknown) =>
  listingDescriptionDoc.safeParse(value).error?.issues.map((issue) => issue.message)

const PASTED = doc(
  heading(2, "Şam çeliği"),
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Katmanlı", marks: [{ type: "bold" }] },
      { type: "text", text: " çelik; " },
      { type: "text", text: "bakım", marks: [{ type: "link", attrs: { href: "/bakim" } }] },
    ],
  },
  {
    type: "bulletList",
    content: [{ type: "listItem", content: [paragraph("El dövmesi")] }],
  },
  {
    type: "table",
    content: [
      { type: "tableRow", content: [{ type: "tableHeader", content: [paragraph("Sertlik")] }] },
    ],
  }
)

describe("a listing description document (adr/0075)", () => {
  it("takes what a pasted text keeps: headings, paragraphs, lists, marks, links and tables", () => {
    expect(listingDescriptionDoc.parse(PASTED)).toEqual(PASTED)
    expect(listingDescriptionDoc.parse(doc(heading(3, "A"), heading(4, "B")))).toBeTruthy()
  })

  it("refuses pictures and cards with its own key", () => {
    expect(
      messagesOf(doc({ type: "image", attrs: { src: "https://cdn.example.com/a.jpg" } }))
    ).toEqual(["catalog.listing_description_blocks"])
    expect(
      messagesOf(doc({ type: "productCard", attrs: { id: "prod_01JC0000000000000000000000" } }))
    ).toEqual(["catalog.listing_description_blocks"])
  })

  it("refuses an h1 (the page's name is its only one), unsafe links and other shapes", () => {
    expect(messagesOf(doc(heading(1 as 2, "Başlık")))).toEqual(["content.body_invalid"])
    expect(messagesOf({ type: "doc", content: [{ type: "codeBlock" }] })).toEqual([
      "content.body_invalid",
    ])
    expect(messagesOf("<p>html</p>")).toBeDefined()
  })
})

describe("what a listing description save writes (adr/0075)", () => {
  const none = { doc: null, description: null }

  it("keeps a document with text and mirrors its plain text", () => {
    expect(listingDescriptionChanges({ doc: PASTED }, none, null)).toEqual({
      doc: PASTED,
      description: "Şam çeliği\n\nKatmanlı çelik; bakım\n\nEl dövmesi\n\nSertlik",
    })
  })

  it("writes only what changes", () => {
    const text = "Şam çeliği\n\nKatmanlı çelik; bakım\n\nEl dövmesi\n\nSertlik"
    expect(
      listingDescriptionChanges({ doc: PASTED }, { doc: PASTED, description: text }, null)
    ).toEqual({ doc: PASTED })
    expect(listingDescriptionChanges({}, { doc: PASTED, description: text }, null)).toEqual({})
  })

  it("clears both for a document without text, as the record's column takes none", () => {
    const current = { doc: PASTED, description: "Eski" }
    expect(listingDescriptionChanges({ doc: doc(paragraph("  ")) }, current, null)).toEqual({
      doc: null,
      description: null,
    })
    // Medusa's category takes "" for none
    expect(listingDescriptionChanges({ doc: doc() }, current, "")).toEqual({
      doc: null,
      description: "",
    })
  })

  it("drops the document and keeps the text for null", () => {
    expect(
      listingDescriptionChanges({ doc: null }, { doc: PASTED, description: "Eski" }, null)
    ).toEqual({ doc: null })
    expect(
      listingDescriptionChanges({ doc: null }, { doc: null, description: "Eski" }, null)
    ).toEqual({})
  })

  it("drops the document when a plain text is written (an import, a script)", () => {
    expect(
      listingDescriptionChanges({ text: "Yeni" }, { doc: PASTED, description: "Eski" }, null)
    ).toEqual({ doc: null })
    expect(
      listingDescriptionChanges({ text: "Yeni" }, { doc: null, description: "Eski" }, null)
    ).toEqual({})
  })
})

describe("a stored listing description", () => {
  it("renders as a page's body, null without one or with one out of shape", () => {
    expect(listingDescriptionHtml(PASTED)).toBe(
      '<h2>Şam çeliği</h2><p><strong>Katmanlı</strong> çelik; <a href="/bakim">bakım</a></p>' +
        "<ul><li><p>El dövmesi</p></li></ul>" +
        "<table><tbody><tr><th><p>Sertlik</p></th></tr></tbody></table>"
    )
    expect(listingDescriptionHtml(null)).toBeNull()
    expect(listingDescriptionHtml(undefined)).toBeNull()
    expect(listingDescriptionHtml({ type: "doc", content: [] })).toBeNull()
    expect(listingDescriptionHtml({ type: "nope" })).toBeNull()
  })

  it("opens in the panel's editor as stored, none when out of shape", () => {
    expect(storedListingDoc(PASTED)).toEqual(PASTED)
    expect(storedListingDoc(null)).toBeNull()
    expect(storedListingDoc({ type: "nope" })).toBeNull()
  })
})
