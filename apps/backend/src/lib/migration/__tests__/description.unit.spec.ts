import { descriptionOf } from "../description"

describe("a source's HTML description as a document (adr/0055)", () => {
  it("keeps headings, lists and tables, and gives the document's plain text", () => {
    const { doc, text, cut } = descriptionOf(
      "<h3>Bakım</h3><p>Elde <em>yıkayın</em>.</p><ol><li>Kurulayın</li><li>Yağlayın</li></ol>" +
        "<table><tr><td>Çap</td><td>28 cm</td></tr></table><img src='x.jpg'>"
    )
    expect(doc?.content.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "orderedList",
      "table",
    ])
    expect(text).toBe("Bakım\n\nElde yıkayın.\n\nKurulayın\nYağlayın\n\nÇap · 28 cm")
    expect(cut).toBe(false)
  })

  it("reads WordPress shortcodes only where asked: another source's brackets are its text", () => {
    expect(descriptionOf("<p>[yeni] sezon</p>").text).toBe("sezon")
    expect(descriptionOf("<p>[yeni] sezon</p>", { shortcodes: false }).text).toBe("[yeni] sezon")
  })

  it("is none for a body without text", () => {
    expect(descriptionOf("<p> </p><img src='a.jpg'><script>x()</script>")).toEqual({
      doc: null,
      text: null,
      cut: false,
    })
  })
})
