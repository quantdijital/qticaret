import { describe, expect, it } from "vitest"
import { docOfPostDraft, readPostDraft } from "./post-draft"

/**
 * A post draft as the panel reads it (adr/0074 §5 madde 5): another shape
 * is never shown, a link off the shop is dropped, and the editor gets
 * heading and paragraph nodes of plain text only.
 */

const link = (path: string) => ({
  code: "k1",
  kind: "category",
  name: "Termoslar",
  path,
  why: "Girişte",
})

describe("readPostDraft", () => {
  it("keeps the sections and the links on the shop only", () => {
    const draft = readPostDraft({
      sections: [
        { heading: "", paragraphs: ["Giriş."] },
        { heading: "Bölüm", level: 3, paragraphs: ["Metin.", 3, ""] },
        { heading: "", paragraphs: ["Başlıksız ikinci bölüm düşer."] },
        { heading: "Boş", paragraphs: [] },
      ],
      links: [
        link("/kategori/termoslar"),
        link("//evil.example"),
        link("https://evil.example"),
        link("javascript:alert(1)"),
        link("/bosluk var"),
        { ...link("/x"), kind: "page" },
      ],
      words: 620,
    })
    expect(draft).toEqual({
      sections: [
        { heading: "", level: 2, paragraphs: ["Giriş."] },
        { heading: "Bölüm", level: 3, paragraphs: ["Metin."] },
      ],
      links: [link("/kategori/termoslar")],
      words: 620,
    })
  })

  it("reads nothing of another shape", () => {
    expect(readPostDraft(null)).toBeNull()
    expect(readPostDraft({ items: [] })).toBeNull()
    expect(readPostDraft({ sections: [{ heading: 1, paragraphs: ["x"] }] })).toBeNull()
  })
})

describe("docOfPostDraft", () => {
  it("gives headings and paragraphs of plain text, the opening with no heading", () => {
    expect(
      docOfPostDraft({
        sections: [
          { heading: "", level: 2, paragraphs: ["Giriş <script>x</script>"] },
          { heading: "Bölüm", level: 3, paragraphs: [" Metin. "] },
        ],
        links: [],
        words: 0,
      })
    ).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Giriş <script>x</script>" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Bölüm" }] },
        { type: "paragraph", content: [{ type: "text", text: "Metin." }] },
      ],
    })
  })
})
