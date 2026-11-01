import { contentDoc } from "../doc"
import { inlineOf, markdownToDoc } from "../markdown"

describe("markdownToDoc", () => {
  it("keeps headings below the title, paragraphs, lists and quotes", () => {
    const doc = markdownToDoc(
      [
        "# HAKKIMIZDA",
        "",
        "Denizli merkezli bir",
        "atölye mağazasıyız.",
        "",
        "## Misyonumuz",
        "",
        "- Güven",
        "- Dayanıklılık",
        "",
        "3. Üçüncü madde",
        "4. Dördüncü madde",
        "",
        "> Not: el yapımıdır.",
        "",
        "###### Göz başlığı",
      ].join("\n")
    )

    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Denizli merkezli bir atölye mağazasıyız." }],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Misyonumuz" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Güven" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Dayanıklılık" }] }],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Üçüncü madde" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Dördüncü madde" }] }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Not: el yapımıdır." }] }],
        },
        { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Göz başlığı" }] },
      ],
    })
    // What it makes passes the document's own check
    expect(contentDoc.safeParse(doc).success).toBe(true)
  })

  it("marks bold and italic, turns the old site's links into paths and drops unsafe ones", () => {
    expect(
      inlineOf(
        "**Önemli** ve *ince* [koleksiyon](https://www.mylarte.com/ozel-koleksiyon/) [başka](https://ornek.com/a) [kötü](javascript:alert(1))",
        "mylarte.com"
      )
    ).toEqual([
      { type: "text", text: "Önemli", marks: [{ type: "bold" }] },
      { type: "text", text: " ve " },
      { type: "text", text: "ince", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      {
        type: "text",
        text: "koleksiyon",
        marks: [{ type: "link", attrs: { href: "/ozel-koleksiyon" } }],
      },
      { type: "text", text: " " },
      {
        type: "text",
        text: "başka",
        marks: [{ type: "link", attrs: { href: "https://ornek.com/a" } }],
      },
      { type: "text", text: " " },
      { type: "text", text: "kötü" },
      { type: "text", text: ")" },
    ])
  })

  it("leaves out a heading that only repeats the page's title", () => {
    const doc = markdownToDoc("## SIK SORULAN SORULAR\n\n### Ödeme\n\nMetin", {
      title: "Sık Sorulan Sorular",
    })
    expect(doc.content.map((block) => block.type)).toEqual(["heading", "paragraph"])
  })

  it("drops pictures, tables and rules, and gives an empty document for an empty text", () => {
    const doc = markdownToDoc(
      "![logo](https://x.com/a.png)\n\n| a | b |\n|---|---|\n\n---\n\nMetin"
    )
    expect(doc.content).toEqual([{ type: "paragraph", content: [{ type: "text", text: "Metin" }] }])
    expect(markdownToDoc("  \n\n")).toEqual({ type: "doc", content: [] })
  })
})
