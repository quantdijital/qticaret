import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { BlogIndexPageView, PostCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's blog list (design.md § İçerik sayfaları): the newest
 * post large on a graphite stage, the blog's categories as pills, the
 * rest as cards in full rows, and an archive's own words.
 */

const post = (n: number): PostCardView => ({
  title: `Yazı ${String(n)}`,
  path: `/blog/yazi-${String(n)}`,
  excerpt: `Yazı ${String(n)} özeti.`,
  image: {
    src: `/media/${String(n)}.jpg`,
    alt: "",
    width: 1280,
    height: 756,
    sources: { avif: null, webp: null },
  },
  date: "30 Ekim 2026",
  dateTime: "2026-10-30T09:00:00.000Z",
  reading: "9 dk okuma",
  category: { label: "Çelikler", path: "/blog/kategori/celikler" },
})

const blog = (over: Partial<BlogIndexPageView> = {}): BlogIndexPageView => ({
  title: "Blog",
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Blog", path: null },
  ],
  posts: Array.from({ length: 12 }, (_, index) => post(index + 1)),
  pagination: {
    page: 1,
    pages: 2,
    previous: null,
    next: "/blog?sayfa=2",
    pagePath: { 1: "/blog", 2: "/blog?sayfa=2" },
  },
  terms: [
    { label: "Tüm yazılar", path: "/blog", current: true },
    { label: "Çelikler", path: "/blog/kategori/celikler", current: false },
  ],
  activeTerm: null,
  ...over,
})

describe("the theme's blog list", () => {
  it("sets the newest post on a graphite stage on the first page, the categories as pills", () => {
    const html = renderPage(atolyeTheme, "BlogIndexPage", { view: blog() })
    expect(html).toMatch(/<article class="gf-stage group relative grid/)
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('href="/blog/kategori/celikler"')
    expect(html.match(/<h2/g)).toHaveLength(12)
    expect(html).not.toContain(" · ")
  })

  it("draws a later page's posts as cards only, with the pages", () => {
    const html = renderPage(atolyeTheme, "BlogIndexPage", {
      view: blog({
        pagination: {
          page: 2,
          pages: 2,
          previous: "/blog",
          next: null,
          pagePath: { 1: "/blog", 2: "/blog?sayfa=2" },
        },
      }),
    })
    expect(html).not.toContain("gf-stage group")
    expect(html).toContain('rel="prev"')
  })

  it("says an archive is empty, and shows its own words", () => {
    const html = renderPage(atolyeTheme, "BlogIndexPage", {
      view: blog({
        title: "Çelikler",
        posts: [],
        activeTerm: { kind: "category", name: "Çelikler", description: ["Çelik rehberleri."] },
      }),
    })
    expect(html).toContain("Çelik rehberleri.")
    expect(html).toContain("Bu başlıkta henüz yazı yok.")
  })

  it("puts two or four posts half wide under the lead so the rows of three come out full", () => {
    const pairOf = (count: number) => {
      const html = renderPage(atolyeTheme, "BlogIndexPage", {
        view: blog({ posts: Array.from({ length: count }, (_, index) => post(index + 1)) }),
      })
      const open = 'md:grid-cols-[repeat(2,minmax(0,1fr))]">'
      const at = html.indexOf(open)
      return at < 0 ? 0 : (html.slice(at, html.indexOf("</ul>", at)).match(/<li/g) ?? []).length
    }
    // 12 posts: the lead, two half wide, nine in rows of three
    expect(pairOf(12)).toBe(2)
    expect(pairOf(11)).toBe(4)
    expect(pairOf(10)).toBe(0)
  })
})
