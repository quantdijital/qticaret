import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { STRIP_GALLERY_DEFAULTS } from "@qticaret/types"
import type { ImageView, StripGallerySectionView } from "@qticaret/ui"
import { buildAtolyeCss } from "@/test/tailwind-build"
import { stripSizes } from "../../../../../packages/themes/atolye/src/parts/Strips"
import { StripGallery } from "../../../../../packages/themes/atolye/src/sections/StripGallery"

/**
 * The strip gallery in Atölye (`sections/StripGallery.tsx`, adr/0049 Ek
 * 2026-11-16): the shared strips across the section, edge to edge or in
 * the container, every strip kept on a phone (scrolled to), the shop's
 * words over each strip's foot with the editor's marks at its saved place.
 */

const t = (key: string) => key

const photo = (name: string, alt = ""): ImageView => ({
  src: `/media/${name}.webp`,
  alt,
  width: 900,
  height: 1200,
  sources: { avif: null, webp: null },
})

const gallery = (
  count: number,
  more: Partial<StripGallerySectionView> = {}
): StripGallerySectionView => ({
  id: "serit01",
  type: "strip_gallery",
  title: null,
  text: null,
  items: Array.from({ length: count }, (_, at) => ({
    at,
    image: photo(`s${String(at)}`),
    title: `Başlık ${String(at)}`,
    note: at === 0 ? "1.250,00 TL" : null,
    href: `/yol-${String(at)}`,
  })),
  ...STRIP_GALLERY_DEFAULTS,
  ...more,
})

const draw = (section: StripGallerySectionView, first = false) =>
  renderToStaticMarkup(<StripGallery section={section} t={t} first={first} />)

const count = (html: string, needle: string) => html.split(needle).length - 1

describe("the strip gallery's markup", () => {
  it("stands edge to edge by default, every strip a link with its words, scrolled to on a phone", () => {
    const html = draw(gallery(6))
    expect(html).toMatch(/^<section class="gf-strip-gallery gf-section" data-width="full"/)
    // No heading: the region is named for a screen reader, the list is not named twice
    expect(html).toContain('aria-label="home.strip_gallery"')
    expect(html).not.toContain("<h2")
    expect(html).not.toContain("mx-auto w-full max-w-(--container)")
    expect(html).toContain('data-count="6"')
    expect(html).toContain('data-phone="scroll"')
    expect(count(html, '<a href="/yol-')).toBe(6)
    expect(html).toContain('<span class="gf-strip-title">Başlık 0</span>')
    expect(html).toContain('<span class="gf-strip-note">1.250,00 TL</span>')
    // The featured product's look by default: medium seams, a thin line, the others darkening
    expect(html).toContain('data-slant="medium"')
    expect(html).toContain('data-line="thin"')
    expect(html).toContain('data-dim="on"')
    expect(html).not.toContain("data-overlap")
    expect(html).not.toContain("style=")
  })

  it("holds the strips in the container when boxed, the heading and its line above them", () => {
    const html = draw(gallery(3, { width: "boxed", title: "Seçkiler", text: "Bu ay atölyeden" }))
    expect(html).toContain('data-width="boxed"')
    expect(html).toContain('aria-labelledby="bolum-serit01"')
    expect(html).toContain('<h2 id="bolum-serit01">Seçkiler</h2>')
    expect(html).toContain("Bu ay atölyeden</p>")
    expect(count(html, "max-w-(--container)")).toBe(2)
  })

  it("draws every strip up to eight, the steps the shop set and its height", () => {
    const html = draw(
      gallery(8, {
        strips_slant: "steep",
        strips_line: "none",
        strips_overlap: "on",
        strips_dim: "off",
        height: "high",
      })
    )
    expect(html).toContain('data-count="8"')
    expect(html).toContain('data-slant="steep"')
    expect(html).toContain('data-line="none"')
    expect(html).toContain('data-overlap="on"')
    expect(html).not.toContain("data-dim")
    expect(html).toContain("lg:aspect-[16/9]")
  })

  it("marks each strip's words at its saved place in the editor, never on a live page", () => {
    const section = gallery(2)
    const moved = {
      ...section,
      editor: true as const,
      items: section.items.map((item) => ({ ...item, at: item.at + 1 })),
    }
    const html = draw(moved)
    expect(html).toContain('data-qf="items.1.title"')
    expect(html).toContain('data-qf="items.1.note"')
    expect(html).toContain('data-qf="items.2.title"')
    expect(draw(section)).not.toContain("data-qf")
  })

  it("asks for the first photograph at once only when it opens the page", () => {
    expect(draw(gallery(3), true)).toContain('fetchPriority="high"')
    expect(count(draw(gallery(3), true), 'loading="eager"')).toBe(1)
    expect(draw(gallery(3))).not.toContain('loading="eager"')
    // Opening the page edge to edge, it sits right under the header
    expect(draw(gallery(3), true)).toMatch(/^<section class="gf-strip-gallery" data-width="full"/)
  })
})

describe("the strips' sizes when a phone scrolls them", () => {
  it("draws each scrolled strip a phone's and a tablet's set share, a row that fits as before", () => {
    expect(stripSizes(6, 100, undefined, "scroll")).toMatch(/\(min-width: 640px\) 30vw, 43vw$/)
    expect(stripSizes(4, 100, undefined, "scroll")).toMatch(/\(min-width: 640px\) 25vw, 43vw$/)
    expect(stripSizes(3, 100, undefined, "scroll")).toBe(stripSizes(3, 100))
    expect(stripSizes(6, 100)).toMatch(/\(min-width: 640px\) 25vw, 34vw$/)
  })
})

describe("the strip gallery's stylesheet", () => {
  it("scrolls a row with more strips than a phone or tablet shows, below 1024 px only", async () => {
    const css = await buildAtolyeCss([])
    expect(css).toMatch(
      /@media \(max-width: 63\.99rem\) \{\s*\.gf-strips\[data-phone="scroll"\] \{[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;/
    )
    expect(css).toContain("flex: 1 0 calc(100cqw * var(--strip-share, 0));")
    expect(css).toContain("--strip-share: 0.43;")
    expect(css).toContain("--strip-share: 0.3;")
  })

  it("meets the screen's edges square when edge to edge", async () => {
    const css = await buildAtolyeCss([])
    expect(css).toMatch(
      /\.gf-strip-gallery\[data-width="full"\] \.gf-strips \{\s*border-radius: 0;/
    )
  })
})
