import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { AuthorView, CategoryTreeView, ImageView, PostCardView } from "@qticaret/ui"
import { withPictures } from "@/lib/views/prose-images"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * docs/21 2026-11-06, open item 1: every library picture the Grafit theme
 * shows outside a product (category covers in the menu, the aisles and
 * `/kategoriler`, blog cards, a post's cover, the author's photo, the
 * pictures in a text) is printed with its AVIF and WebP versions, so the
 * browser takes the small file the `sizes` ask for, never the original.
 */

const versions = (name: string): ImageView => ({
  src: `/media/${name}.webp`,
  alt: "",
  width: 1200,
  height: 900,
  sources: {
    avif: `/media/${name}-400.avif 400w, /media/${name}-800.avif 800w`,
    webp: `/media/${name}-400.webp 400w, /media/${name}-800.webp 800w`,
  },
})

/** The `<picture>` around the file: its AVIF source with these versions. */
const pictured = (html: string, name: string) =>
  html.includes(`<source type="image/avif" srcSet="/media/${name}-400.avif 400w`) &&
  html.includes(`<source type="image/webp" srcSet="/media/${name}-400.webp 400w`)

const ayse: AuthorView = {
  name: "Ayşe Usta",
  path: "/blog/yazar/ayse-usta",
  jobTitle: null,
  bio: ["Yirmi yıldır bıçak yapıyor."],
  image: versions("ayse"),
  links: [],
}

const card: PostCardView = {
  title: "Elmax",
  path: "/blog/elmax",
  excerpt: "Özet.",
  image: versions("elmax"),
  date: null,
  dateTime: null,
  reading: "3 dk okuma",
  category: null,
}

describe("the theme prints library pictures in their versions", () => {
  it("in the header's category dropdown rows", () => {
    const categories = shopFixture().categories.map((category, index) =>
      index === 0
        ? {
            ...category,
            children: category.children.map((child, at) =>
              at === 0 ? { ...child, image: versions("katlanir") } : child
            ),
          }
        : category
    )
    expect(pictured(renderFrame(atolyeTheme, shopFixture({ categories })), "katlanir")).toBe(true)
  })

  it("on /kategoriler: the section's small picture and the tiles", () => {
    const node = (path: string, children: CategoryTreeView[] = []): CategoryTreeView => ({
      label: path,
      path: `/${path}`,
      image: versions(path),
      children,
    })
    const html = renderPage(atolyeTheme, "CategoriesPage", {
      view: {
        title: "Kategoriler",
        breadcrumbs: [],
        categories: [node("cakilar", [node("katlanir")]), node("av")],
        total: null,
      },
    })
    expect(pictured(html, "cakilar")).toBe(true)
    expect(pictured(html, "katlanir")).toBe(true)
    expect(pictured(html, "av")).toBe(true)
  })

  it("on the blog's cards and the author's page", () => {
    const html = renderPage(atolyeTheme, "BlogIndexPage", {
      view: {
        title: "Ayşe Usta",
        breadcrumbs: [],
        posts: [card, { ...card, path: "/blog/b", image: versions("ikinci") }],
        pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: { 1: "" } },
        activeTerm: null,
        activeAuthor: ayse,
      },
    })
    expect(pictured(html, "elmax")).toBe(true)
    expect(pictured(html, "ikinci")).toBe(true)
    expect(pictured(html, "ayse")).toBe(true)
  })

  it("on a post: its cover, the author's box and the pictures in its text", () => {
    const text = withPictures(
      '<p>Giriş</p><figure><img src="/media/govde.webp" alt="Gövde" loading="lazy" decoding="async"></figure>',
      [
        {
          url: "/media/govde.webp",
          width: 1600,
          height: 1000,
          derivatives: { srcset: { avif: [{ width: 400, url: "/media/govde-400.avif" }] } },
        },
      ]
    )
    const html = renderPage(atolyeTheme, "ContentPage", {
      view: {
        title: "Elmax Çelik Nedir?",
        breadcrumbs: [],
        html: text,
        publishedAt: null,
        image: versions("kapak"),
        post: { date: null, dateTime: null, reading: "3 dk okuma", author: null, authorPath: null },
        author: ayse,
      },
      actions: { sendContact: () => Promise.resolve({ ok: true, error: null, challenge: null }) },
    })
    expect(pictured(html, "kapak")).toBe(true)
    expect(pictured(html, "ayse")).toBe(true)
    expect(html).toContain('<source type="image/avif" srcset="/media/govde-400.avif 400w"')
    expect(html).toMatch(
      /<img src="\/media\/govde.webp" alt="Gövde" width="1600" height="1000" loading="lazy"/
    )
  })
})
