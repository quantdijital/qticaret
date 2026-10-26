import { contentDoc, docStats, isSafeHref, renderDoc } from ".."
import { plainText } from "../../seo/resolve"

const nested = (depth: number): unknown =>
  depth === 0
    ? { type: "paragraph", content: [{ type: "text", text: "x" }] }
    : { type: "orderedList", content: [{ type: "listItem", content: [nested(depth - 1)] }] }

const timed = (run: () => void): number => {
  const started = performance.now()
  run()
  return performance.now() - started
}

describe("content bounds (no input costs more than its size)", () => {
  it("refuses deep nesting before parsing it", () => {
    let result: ReturnType<typeof contentDoc.safeParse> | undefined
    const ms = timed(() => {
      result = contentDoc.safeParse({ type: "doc", content: [nested(40)] })
    })
    expect(result?.success).toBe(false)
    expect(result?.error?.issues[0]?.message).toBe("content.too_large")
    expect(ms).toBeLessThan(200)
  })

  it("parses each node once, whatever the nesting it is allowed", () => {
    const ms = timed(() => {
      expect(contentDoc.safeParse({ type: "doc", content: [nested(5)] }).success).toBe(true)
    })
    expect(ms).toBeLessThan(200)
  })

  it("reads a long run of marks or brackets in one pass", () => {
    // Five paragraphs of 20,000 dots then a letter: the sentence counter's worst case
    const paragraph = {
      type: "paragraph",
      content: [{ type: "text", text: ".".repeat(19_999) + "a" }],
    }
    const doc = contentDoc.parse({
      type: "doc",
      content: Array.from({ length: 5 }, () => paragraph),
    })
    expect(timed(() => docStats(doc))).toBeLessThan(200)
    expect(timed(() => plainText("<".repeat(100_000)))).toBeLessThan(200)
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
})
