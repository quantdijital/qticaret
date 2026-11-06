import { describe, expect, it } from "vitest"
import type { StoreBodyImage } from "@qticaret/types"
import { PROSE_IMAGE_SIZES, withPictures } from "../prose-images"

// The backend's tag for a picture in a text (adr/0019, lib/content/render.ts)
const img = (src: string, alt = "") =>
  `<figure><img src="${src}" alt="${alt}" loading="lazy" decoding="async"></figure>`

const KAPAK: StoreBodyImage = {
  url: "https://cdn.example.com/kapak.webp?v=1&s=2",
  width: 1200,
  height: 800,
  derivatives: {
    srcset: {
      webp: [
        { width: 800, url: "https://cdn.example.com/kapak-800.webp" },
        { width: 400, url: "https://cdn.example.com/kapak-400.webp" },
      ],
      avif: [{ width: 400, url: "https://cdn.example.com/kapak-400.avif" }],
    },
  },
}

const ESCAPED = "https://cdn.example.com/kapak.webp?v=1&amp;s=2"

describe("withPictures (docs/21 2026-11-06)", () => {
  it("prints a library picture's versions, sizes and size, lazily", () => {
    const html = `<p>Giriş</p><p>İkinci</p>${img(ESCAPED, "Çeliğin &quot;dokusu&quot;")}`
    const out = withPictures(html, [KAPAK])
    expect(out).toContain(
      `<source type="image/avif" srcset="https://cdn.example.com/kapak-400.avif 400w" sizes="${PROSE_IMAGE_SIZES}">`
    )
    // Narrowest first, whatever order the backend gave
    expect(out).toContain(
      'srcset="https://cdn.example.com/kapak-400.webp 400w, https://cdn.example.com/kapak-800.webp 800w"'
    )
    expect(out).toContain(
      '<img src="https://cdn.example.com/kapak.webp?v=1&#38;s=2" alt="Çeliğin &#34;dokusu&#34;" width="1200" height="800" loading="lazy" decoding="async"></picture>'
    )
    expect(out.indexOf('type="image/avif"')).toBeLessThan(out.indexOf('type="image/webp"'))
    expect(out).toMatch(/^<p>Giriş<\/p><p>İkinci<\/p><figure><picture>/)
  })

  it("loads the opening picture at once when no cover is above it, the others lazily", () => {
    const html = `<p>Giriş</p>${img(ESCAPED)}${img(ESCAPED)}`
    const out = withPictures(html, [KAPAK], { cover: false })
    const tags = out.match(/<img [^>]*>/g) ?? []
    expect(tags).toHaveLength(2)
    expect(tags[0]).toContain('loading="eager" fetchpriority="high"')
    expect(tags[1]).toContain('loading="lazy"')
    expect(tags[1]).not.toContain("fetchpriority")
  })

  it("keeps the opening picture lazy under a cover, or when the text opens with words", () => {
    expect(withPictures(img(ESCAPED), [KAPAK])).not.toContain("eager")
    const late = `<p>1</p><p>2</p><p>3</p>${img(ESCAPED)}`
    expect(withPictures(late, [KAPAK], { cover: false })).not.toContain("eager")
  })

  it("leaves a picture the library does not know as the backend wrote it", () => {
    const html = img("https://old.example.com/a.jpg", "Eski")
    expect(withPictures(html, [KAPAK])).toBe(html)
    expect(withPictures(html, undefined)).toBe(html)
    // Opening the page, it still loads at once
    expect(withPictures(html, [], { cover: false })).toBe(
      '<figure><img src="https://old.example.com/a.jpg" alt="Eski" decoding="async" loading="eager" fetchpriority="high"></figure>'
    )
  })

  it("prints the size alone for a picture whose versions are not made yet", () => {
    const bare = { ...KAPAK, derivatives: null }
    const out = withPictures(img(ESCAPED), [bare])
    expect(out).not.toContain("<picture>")
    expect(out).toContain('width="1200" height="800" loading="lazy"')
  })

  it("changes nothing in a text without pictures", () => {
    const html = "<h2>Başlık</h2><p>Metin</p>"
    expect(withPictures(html, [KAPAK], { cover: false })).toBe(html)
  })
})
