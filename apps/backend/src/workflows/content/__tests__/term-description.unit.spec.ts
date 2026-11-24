import { ValidationError } from "../../../lib/errors"
import {
  AdminPostContentTerm,
  AdminUpdateContentTerm,
} from "../../../api/admin/content/terms/validators"
import { termDescription } from "../term-plan"

/** A document of a heading and a paragraph, as the panel's editor sends it. */
const docOf = (heading: string, text: string) => ({
  type: "doc" as const,
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: heading }] },
    { type: "paragraph", content: [{ type: "text", text }] },
  ],
})

const parsed = (body: unknown) => AdminUpdateContentTerm.parse(body).description_doc

describe("a blog term's description (adr/0075 Ek 2026-11-24)", () => {
  it("keeps a document with text and writes its plain text beside it", () => {
    const doc = parsed({ description_doc: docOf("Bakım", "Bıçağınızı kuru tutun.") })

    const fields = termDescription({ description_doc: doc }, { description: "Eski" })

    expect(fields.description_doc).toEqual(doc)
    expect(fields.description).toContain("Bakım")
    expect(fields.description).toContain("Bıçağınızı kuru tutun.")
  })

  it("clears both for a document without text; null drops the document and keeps the text", () => {
    const empty = parsed({ description_doc: { type: "doc", content: [{ type: "paragraph" }] } })
    const stored = { description: "Metin", description_doc: docOf("B", "Metin") }

    expect(termDescription({ description_doc: empty }, stored)).toEqual({
      description: null,
      description_doc: null,
    })
    expect(termDescription({ description_doc: null }, stored)).toEqual({
      description: "Metin",
      description_doc: null,
    })
  })

  it("takes plain text as before (an import), one line, and drops a document the term had", () => {
    const stored = { description: "Eski", description_doc: docOf("Eski", "Eski") }

    expect(termDescription({ description: "  Yeni   metin " }, stored)).toEqual({
      description: "Yeni metin",
      description_doc: null,
    })
    expect(termDescription({ description: "" }, null)).toEqual({
      description: null,
      description_doc: null,
    })
    expect(() => termDescription({ description: "x".repeat(1001) }, null)).toThrow(ValidationError)
  })

  it("refuses a document whose text is past an archive's foot (5000 characters)", () => {
    const ofLength = (length: number) =>
      parsed({
        description_doc: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(length) }] }],
        },
      })
    const long = ofLength(5001)
    const fits = ofLength(5000)

    let refused: unknown = null
    try {
      termDescription({ description_doc: long }, null)
    } catch (error) {
      refused = error
    }
    expect(refused).toBeInstanceOf(ValidationError)
    expect((refused as ValidationError).safeMessage).toBe("content.term_description_too_long")
    expect(termDescription({ description_doc: fits }, null).description).toHaveLength(5000)
  })

  it("leaves both alone when the save names neither", () => {
    const stored = { description: "Metin", description_doc: docOf("B", "Metin") }

    expect(termDescription({}, stored)).toEqual(stored)
  })

  it("refuses a picture, a card or both kinds of description in one save", () => {
    const picture = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://cdn.example.com/a.jpg", alt: "" } }],
    }

    expect(AdminUpdateContentTerm.safeParse({ description_doc: picture }).success).toBe(false)
    expect(
      AdminPostContentTerm.safeParse({
        kind: "tag",
        name: "Bakım",
        description: "Düz",
        description_doc: docOf("B", "Belge"),
      }).success
    ).toBe(false)
    expect(
      AdminPostContentTerm.safeParse({ kind: "tag", name: "Bakım", description_doc: null }).success
    ).toBe(true)
  })
})
