import { describe, expect, it } from "vitest"
import { normalizeDoc, sameDoc } from "./normalize"

const text = (value: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
})

describe("the editor's document as the server stores it", () => {
  it("keeps only the attributes the server keeps", () => {
    expect(
      normalizeDoc({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              text("bağlantı", [
                { type: "link", attrs: { href: "/kategori/kupa", target: "_blank", rel: null } },
              ]),
            ],
          },
          {
            type: "image",
            attrs: { src: "https://cdn.example.com/a.webp", alt: "Kupa", width: 300 },
          },
        ],
      })
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("bağlantı", [{ type: "link", attrs: { href: "/kategori/kupa" } }])],
        },
        { type: "image", attrs: { src: "https://cdn.example.com/a.webp", alt: "Kupa" } },
      ],
    })
  })

  it("drops a link the server would refuse, and numbers out of its bounds", () => {
    const doc = normalizeDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            text("a@b.c", [{ type: "link", attrs: { href: "mailto:a@b.c" } }, { type: "bold" }]),
          ],
        },
        { type: "orderedList", attrs: { start: -3 }, content: [] },
      ],
    })
    expect(doc.content?.[0]?.content?.[0]).toEqual(text("a@b.c", [{ type: "bold" }]))
    expect(doc.content?.[1]).toEqual({ type: "orderedList", content: [] })
  })

  it("sees no change in the empty paragraph the editor keeps at the end", () => {
    const stored = { type: "doc", content: [{ type: "bulletList", content: [] }] }
    const edited = {
      type: "doc",
      content: [{ type: "bulletList", content: [] }, { type: "paragraph" }],
    }
    expect(sameDoc(stored, edited)).toBe(true)
    expect(
      sameDoc({ type: "doc", content: [] }, { type: "doc", content: [{ type: "paragraph" }] })
    ).toBe(true)
    expect(
      sameDoc(stored, { type: "doc", content: [{ type: "paragraph", content: [text("x")] }] })
    ).toBe(false)
  })
})
