import { DOC_LIMITS, contentDoc, docStats, isSafeHref, renderDoc } from ".."
import type { ContentDoc } from ".."

const text = (value: string, marks?: unknown[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
})
const p = (...content: unknown[]) => ({ type: "paragraph", content })
const doc = (...content: unknown[]) => ({ type: "doc", content })
const parse = (value: unknown) => contentDoc.safeParse(value)

describe("content documents", () => {
  it("takes what the editor writes, dropping attributes outside the allowlist", () => {
    const result = parse(
      doc(
        {
          type: "heading",
          attrs: { level: 2, textAlign: "left" },
          content: [text("Nasıl seçilir?")],
        },
        p(
          text("Bkz. "),
          text("rehber", [
            { type: "link", attrs: { href: "/blog/rehber", target: "_blank", class: "x" } },
          ])
        ),
        {
          type: "image",
          attrs: { src: "https://cdn.example.com/a.webp", alt: "Kupa", title: "t", width: 10 },
        },
        { type: "productCard", attrs: { id: "prod_01M5PZGKXDPKARZH2QKET4XT25" } }
      )
    )
    expect(result.success).toBe(true)
    expect(result.data?.content[1]).toEqual(
      p(text("Bkz. "), text("rehber", [{ type: "link", attrs: { href: "/blog/rehber" } }]))
    )
    expect(result.data?.content[2]).toEqual({
      type: "image",
      attrs: { src: "https://cdn.example.com/a.webp", alt: "Kupa" },
    })
  })

  it.each([
    ["a node outside the allowlist", doc({ type: "codeBlock", content: [text("x")] })],
    ["an h1", doc({ type: "heading", attrs: { level: 1 }, content: [text("x")] })],
    ["a mark outside the allowlist", doc(p(text("x", [{ type: "underline" }])))],
    ["raw HTML as a node", doc({ type: "html", html: "<script>alert(1)</script>" })],
    [
      "a script link",
      doc(p(text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))),
    ],
    [
      "a protocol-relative link",
      doc(p(text("x", [{ type: "link", attrs: { href: "//evil.example" } }]))),
    ],
    [
      "an image that is not http(s)",
      doc({ type: "image", attrs: { src: "data:image/png;base64,AAAA" } }),
    ],
    [
      "a card id that is not an id",
      doc({ type: "productCard", attrs: { id: "prod_1' onload='x" } }),
    ],
  ])("refuses %s", (_label, value) => {
    expect(parse(value).success).toBe(false)
  })

  it("refuses a document past its bounds", () => {
    const long = doc(...Array.from({ length: 11 }, () => p(text("x".repeat(20_000)))))
    expect(parse(long).success).toBe(false)
    expect(DOC_LIMITS.textLength).toBe(200_000)
  })

  it.each([
    ["/blog/rehber", true],
    ["https://example.com/a?b=1", true],
    ["/a\\b", false],
    ["mailto:a@b.c", false],
    ["https://example.com/\u0000", false],
  ])("judges the link %s", (href, safe) => {
    expect(isSafeHref(href)).toBe(safe)
  })
})

describe("rendering", () => {
  const checked = (value: unknown) => contentDoc.parse(value)

  it("escapes every text and address", () => {
    const html = renderDoc(
      checked(
        doc(
          p(text('<script>alert("x")</script>', [{ type: "bold" }])),
          p(text("a", [{ type: "link", attrs: { href: '/arama?q="><img/src=x/onerror=1>' } }])),
          { type: "image", attrs: { src: "https://cdn.example.com/a.webp", alt: '" onerror="x' } }
        )
      )
    )
    expect(html).toBe(
      "<p><strong>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</strong></p>" +
        '<p><a href="/arama?q=&quot;&gt;&lt;img/src=x/onerror=1&gt;">a</a></p>' +
        '<figure><img src="https://cdn.example.com/a.webp" alt="&quot; onerror=&quot;x" loading="lazy" decoding="async"></figure>'
    )
  })

  it("gives a library picture its measured size, one not measured none (CLS)", () => {
    const html = renderDoc(
      checked(
        doc(
          { type: "image", attrs: { src: "https://cdn.example.com/a.webp", alt: "Atölye" } },
          { type: "image", attrs: { src: "https://cdn.example.com/b.webp", alt: "" } }
        )
      ),
      {
        product: new Map(),
        category: new Map(),
        images: new Map([["https://cdn.example.com/a.webp", { width: 1600, height: 900 }]]),
      }
    )
    expect(html).toBe(
      '<figure><img src="https://cdn.example.com/a.webp" alt="Atölye" width="1600" height="900" loading="lazy" decoding="async"></figure>' +
        '<figure><img src="https://cdn.example.com/b.webp" alt="" loading="lazy" decoding="async"></figure>'
    )
  })

  it("builds lists, tables and quotes, and skips empty paragraphs", () => {
    const html = renderDoc(
      checked(
        doc(
          { type: "paragraph" },
          {
            type: "orderedList",
            attrs: { start: 3 },
            content: [{ type: "listItem", content: [p(text("üç"))] }],
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableHeader", content: [p(text("Ölçü"))] },
                  { type: "tableCell", attrs: { colspan: 2 }, content: [p(text("350 ml"))] },
                ],
              },
            ],
          },
          { type: "blockquote", content: [p(text("söz"), { type: "hardBreak" }, text("iki"))] }
        )
      )
    )
    expect(html).toBe(
      '<ol start="3"><li><p>üç</p></li></ol>' +
        '<table><tbody><tr><th><p>Ölçü</p></th><td colspan="2"><p>350 ml</p></td></tr></tbody></table>' +
        "<blockquote><p>söz<br>iki</p></blockquote>"
    )
  })

  it("draws a card from its record as it is now, and leaves out one that is gone", () => {
    const value = checked(
      doc(
        { type: "productCard", attrs: { id: "prod_01M5PZGKXDPKARZH2QKET4XT25" } },
        { type: "categoryCard", attrs: { id: "pcat_01M5PZGKXDPKARZH2QKET4XT26" } }
      )
    )
    const html = renderDoc(value, {
      product: new Map([
        ["prod_01M5PZGKXDPKARZH2QKET4XT25", { title: "Kupa & Tabak", path: "/urun/kupa" }],
      ]),
      category: new Map(),
    })
    expect(html).toBe(
      '<aside class="qt-card qt-card--product" data-product-id="prod_01M5PZGKXDPKARZH2QKET4XT25">' +
        '<a href="/urun/kupa">Kupa &amp; Tabak</a></aside>'
    )
  })
})

describe("document stats", () => {
  it("reads the text, its structure, links, images and cards", () => {
    const value: ContentDoc = contentDoc.parse(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Kupa nasıl seçilir?")] },
        p(
          text("İlk cümle. İkinci cümle! "),
          text("ürünler", [{ type: "link", attrs: { href: "/kategori/kupa" } }]),
          text(" ve "),
          text("kaynak", [{ type: "link", attrs: { href: "https://example.com" } }])
        ),
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [p(text("liste maddesi"))] }],
        },
        { type: "image", attrs: { src: "https://cdn.example.com/a.webp" } },
        { type: "categoryCard", attrs: { id: "pcat_01M5PZGKXDPKARZH2QKET4XT26" } }
      )
    )
    const stats = docStats(value)
    expect(stats.headings).toEqual([{ level: 2, text: "Kupa nasıl seçilir?" }])
    expect(stats.paragraphs).toEqual([{ sentences: 3, words: 7 }])
    expect(stats.links).toEqual({ internal: 1, external: 1 })
    expect(stats.images).toEqual([{ src: "https://cdn.example.com/a.webp", alt: "" }])
    expect(stats.lists).toBe(1)
    expect(stats.cards.category).toEqual(["pcat_01M5PZGKXDPKARZH2QKET4XT26"])
    expect(stats.text).toBe(
      "Kupa nasıl seçilir?\nİlk cümle. İkinci cümle! ürünler ve kaynak\nliste maddesi"
    )
    expect(stats.words).toBe(12)
    // The heading comes first: no opening before it
    expect(stats.openingWords).toBe(0)
  })
})
