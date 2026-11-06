import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { AuthorView, BlogIndexPageView, ContentPageView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's blog authors (adr/0060, design.md § İçerik
 * sayfaları): the byline linked to the author's page, the box closing the
 * post, and the author's page head over their posts.
 */

const ayse = (over: Partial<AuthorView> = {}): AuthorView => ({
  name: "Ayşe Usta",
  path: "/blog/yazar/ayse-usta",
  jobTitle: "Bıçak ustası",
  bio: ["Yirmi yıldır bıçak yapıyor.", "Atölyede çeliği o seçer."],
  image: {
    src: "/media/ayse.jpg",
    alt: "Ayşe Usta",
    width: 400,
    height: 400,
    sources: { avif: null, webp: null },
  },
  links: [
    { label: "Web sitesi", href: "https://ayse.example.com" },
    { label: "Instagram", href: "https://www.instagram.com/ayse" },
  ],
  ...over,
})

const post = (over: Partial<ContentPageView> = {}) =>
  renderPage(atolyeTheme, "ContentPage", {
    view: {
      title: "Elmax Çelik Nedir?",
      breadcrumbs: [
        { label: "Ana sayfa", path: "/" },
        { label: "Blog", path: "/blog" },
        { label: "Elmax Çelik Nedir?", path: null },
      ],
      html: "<p>Metin.</p>",
      publishedAt: "2026-10-30T09:00:00.000Z",
      post: {
        date: "30 Ekim 2026",
        dateTime: "2026-10-30T09:00:00.000Z",
        reading: "9 dk okuma",
        author: "Ayşe Usta",
        authorPath: "/blog/yazar/ayse-usta",
      },
      author: ayse(),
      share: [{ label: "WhatsApp", href: "https://wa.me/?text=x" }],
      ...over,
    },
    actions: { sendContact: () => Promise.resolve({ ok: true, error: null, challenge: null }) },
  })

describe("the theme's post byline and author box", () => {
  it("links the byline to the author's page", () => {
    expect(post()).toMatch(/Yazan: <a href="\/blog\/yazar\/ayse-usta"[^>]*>Ayşe Usta<\/a>/)
  })

  it("closes the article with the author's box after the share links: photo, name, title, opening, profiles", () => {
    const html = post()
    const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"))
    expect(article.indexOf("Bu yazıyı paylaşın")).toBeLessThan(article.indexOf("Yazar hakkında"))
    expect(article).toContain('aria-labelledby="yazar-hakkinda"')
    expect(article).toContain('src="/media/ayse.jpg"')
    expect(article).toContain("Bıçak ustası")
    expect(article).toContain('<p class="line-clamp-3 text-text-2">Yirmi yıldır bıçak yapıyor.</p>')
    expect(article).not.toContain("Atölyede çeliği o seçer.")
    expect(article).toContain(
      'href="https://www.instagram.com/ayse" target="_blank" rel="noopener" aria-label="Ayşe Usta: Instagram (yeni sekmede açılır)"'
    )
    expect(article).toContain("Tüm yazıları")
    expect(article).not.toContain("nofollow")
  })

  it("shows the initial when the author has no photo", () => {
    const html = post({ author: ayse({ image: null }) })
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*rounded-full[^"]*">A<\/span>/)
  })

  it("keeps a post without a chosen author to the written name: no link, no box", () => {
    const html = post({
      post: { date: null, dateTime: null, reading: "9 dk okuma", author: "Usta", authorPath: null },
      author: null,
    })
    expect(html).toContain("Yazan: Usta")
    expect(html).not.toContain("/blog/yazar/")
    expect(html).not.toContain("Yazar hakkında")
  })
})

const authorPage = (over: Partial<BlogIndexPageView> = {}) =>
  renderPage(atolyeTheme, "BlogIndexPage", {
    view: {
      title: "Ayşe Usta",
      breadcrumbs: [
        { label: "Ana sayfa", path: "/" },
        { label: "Blog", path: "/blog" },
        { label: "Ayşe Usta", path: null },
      ],
      posts: [],
      pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: { 1: "" } },
      activeTerm: null,
      activeAuthor: ayse(),
      ...over,
    },
  })

describe("the theme's author page", () => {
  it("heads the page with the photo, the one h1, the title, the bio and the profiles", () => {
    const html = authorPage()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("<h1>Ayşe Usta</h1>")
    expect(html).toContain("size-24")
    expect(html).toContain("Atölyede çeliği o seçer.")
    expect(html).toContain('href="https://ayse.example.com"')
  })

  it("says the author has no live post yet in place of the list", () => {
    expect(authorPage()).toContain("Bu yazarın henüz yayında yazısı yok.")
  })
})
