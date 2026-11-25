import { measureGrowth } from "@qticaret/testing"
import { contentDoc, docStats, isSafeHref, renderDoc } from ".."
import { plainText } from "../../seo/resolve"

/**
 * Ordered lists nested `depth` deep around one paragraph, which counts every
 * read of its fields: what was read and how often, counted instead of timed (a busy CI
 * runner broke a 200 ms budget; adr/0081).
 */
function counted(depth: number): { doc: unknown; reads: () => number } {
  let reads = 0
  const fields: Record<string, unknown> = {
    type: "paragraph",
    content: [{ type: "text", text: "x" }],
  }
  const innermost = {}
  for (const [key, value] of Object.entries(fields)) {
    Object.defineProperty(innermost, key, {
      enumerable: true,
      get: () => {
        reads += 1
        return value
      },
    })
  }
  let node: unknown = innermost
  for (let level = 0; level < depth; level++) {
    node = { type: "orderedList", content: [{ type: "listItem", content: [node] }] }
  }
  return { doc: { type: "doc", content: [node] }, reads: () => reads }
}

describe("content bounds (no input costs more than its size)", () => {
  it("refuses deep nesting before parsing it", () => {
    // The bounds walk stops at the first level past the limit and never
    // reaches the innermost node; a parse would read it
    const { doc, reads } = counted(40)
    const result = contentDoc.safeParse(doc)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("content.too_large")
    expect(reads()).toBe(0)
  })

  it("parses each node once, whatever the nesting it is allowed", () => {
    // The innermost paragraph is read as often at the deepest nesting allowed
    // as on its own: the bounds walk reads its `text` and `content`, the parse
    // its `type` and `content`, once each. A shape tried again per level
    // would read it more with every level
    const readsAt = (depth: number) => {
      const { doc, reads } = counted(depth)
      expect(contentDoc.safeParse(doc).success).toBe(true)
      return reads()
    }
    const shallow = readsAt(0)
    expect(shallow).toBeLessThanOrEqual(4)
    expect([1, 2, 3, 4, 5].map(readsAt)).toEqual([shallow, shallow, shallow, shallow, shallow])
  })

  it("reads a long run of marks or brackets in one pass", () => {
    // Five paragraphs of dots then a letter: the sentence counter's worst case. Timed at
    // an eighth of 20,000 dots and at 20,000: linear, not a wall-clock budget
    const dots = (size: number) => {
      const paragraph = {
        type: "paragraph",
        content: [{ type: "text", text: ".".repeat(size - 1) + "a" }],
      }
      const doc = contentDoc.parse({
        type: "doc",
        content: Array.from({ length: 5 }, () => paragraph),
      })
      return () => docStats(doc)
    }
    expect(measureGrowth(dots, 2_500)).toMatchObject({ linear: true })
    const brackets = (size: number) => {
      const text = "<".repeat(size)
      return () => plainText(text)
    }
    expect(measureGrowth(brackets, 12_500)).toMatchObject({ linear: true })
    expect(plainText("3 < 5 ve 7 > 4 <b>kalın</b>")).toBe("3 < 5 ve 7 > 4 kalın")
  })
})

describe("content text and links", () => {
  it.each([
    ["https://magaza.example@evil.example/", false],
    ["https://evil‮example.com/", false],
    ["/kategori/kupa​", false],
  ])("judges the link %s", (href, safe) => {
    expect(isSafeHref(href)).toBe(safe)
  })

  it("refuses control characters in text and alt text", () => {
    const text = (value: string) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
    })
    expect(contentDoc.safeParse(text("a\u0000b")).success).toBe(false)
    expect(contentDoc.safeParse(text("a\tb")).success).toBe(true)
    expect(
      contentDoc.safeParse({
        type: "doc",
        content: [
          { type: "image", attrs: { src: "https://cdn.example.com/a.webp", alt: "a\u0007" } },
        ],
      }).success
    ).toBe(false)
  })

  it("makes neighbours linking to one address one link, in the page and in the count", () => {
    const link = [{ type: "link", attrs: { href: "/kategori/kupa" } }]
    const doc = contentDoc.parse({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "kupa ", marks: link },
            { type: "text", text: "çeşitleri", marks: [...link, { type: "bold" }] },
            { type: "text", text: " bitti" },
          ],
        },
      ],
    })
    expect(renderDoc(doc)).toBe(
      '<p><a href="/kategori/kupa">kupa <strong>çeşitleri</strong></a> bitti</p>'
    )
    expect(docStats(doc).links).toEqual({ internal: 1, external: 0 })
  })

  it("opens an outside link with neither the opener nor the referrer (adr/0070 §8)", () => {
    const doc = contentDoc.parse({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "üretici",
              marks: [{ type: "link", attrs: { href: "https://example.com/a" } }],
            },
          ],
        },
      ],
    })
    expect(renderDoc(doc)).toBe(
      '<p><a href="https://example.com/a" rel="noopener noreferrer">üretici</a></p>'
    )
  })
})
