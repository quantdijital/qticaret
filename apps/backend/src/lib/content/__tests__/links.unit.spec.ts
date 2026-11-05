import type { ContentDoc } from "../doc"
import { docHrefs, rewriteDocHrefs } from "../links"

const link = (text: string, href: string) => ({
  type: "text" as const,
  text,
  marks: [{ type: "bold" as const }, { type: "link" as const, attrs: { href } }],
})

const doc: ContentDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Elmax çelik için " },
        link("çakılara", "/el-yapimi-caki/"),
        { type: "text", text: " ve " },
        link("rehbere", "https://mylarte.com/elmax-celik-nedir/"),
      ],
    },
    { type: "heading", attrs: { level: 2 }, content: [link("Başlıkta", "/el-yapimi-caki/")] },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [link("dışarıda", "https://example.org/x")] }],
        },
      ],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [link("tabloda", "/marka/x")] }],
            },
          ],
        },
      ],
    },
    { type: "image", attrs: { src: "/media/x.jpg", alt: "x" } },
  ],
}

describe("a content document's links (adr/0042 Ek 2026-11-05)", () => {
  it("reads every link address once, wherever its text sits, in reading order", () => {
    expect(docHrefs(doc)).toEqual([
      "/el-yapimi-caki/",
      "https://mylarte.com/elmax-celik-nedir/",
      "https://example.org/x",
      "/marka/x",
    ])
    expect(docHrefs(null)).toEqual([])
    expect(docHrefs({ type: "doc", content: [] })).toEqual([])
  })

  it("points the named links at their new addresses and leaves everything else as it was", () => {
    const next = new Map([
      ["/el-yapimi-caki/", "/kategori/el-yapimi-caki"],
      ["https://mylarte.com/elmax-celik-nedir/", "/blog/elmax-celik-nedir"],
    ])
    const { doc: written, changed } = rewriteDocHrefs(doc, next)

    expect(changed).toBe(3)
    expect(docHrefs(written)).toEqual([
      "/kategori/el-yapimi-caki",
      "/blog/elmax-celik-nedir",
      "https://example.org/x",
      "/marka/x",
    ])
    // The text, the other marks, the other blocks: untouched, unchanged parts the same objects
    const paragraph = written.content[0] as { content: { text: string; marks?: unknown[] }[] }
    expect(paragraph.content.map((node) => node.text).join("")).toBe(
      "Elmax çelik için çakılara ve rehbere"
    )
    expect(paragraph.content[1]?.marks?.[0]).toEqual({ type: "bold" })
    expect(written.content[2]).toBe(doc.content[2])
    expect(written.content[4]).toBe(doc.content[4])
    // The original is not changed in place
    expect(docHrefs(doc)[0]).toBe("/el-yapimi-caki/")
  })

  it("gives back the document itself when nothing changes", () => {
    const { doc: written, changed } = rewriteDocHrefs(doc, new Map([["/yok", "/var"]]))
    expect(changed).toBe(0)
    expect(written).toBe(doc)
  })
})
