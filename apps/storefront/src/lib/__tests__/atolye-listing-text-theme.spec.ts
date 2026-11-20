import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ListingPageView, ListingTextView } from "@qticaret/ui"
import { LISTING_TEXT_DEFAULTS } from "@qticaret/types/listing-text"
import { t } from "@/lib/i18n"

/**
 * A category, brand or collection page's own text in the Atölye theme
 * (adr/0075): at the page's foot after the products and their pages,
 * before the category group's bottom sections, never under the title; the
 * shop's size, alignment and measure as classes; a long text folded behind
 * an accessible toggle with every word still in the HTML.
 */

const LONG_HTML = [
  "<h2>Çelik seçimi</h2>",
  `<p>${"Her çakı atölyede tek tek dövülür ve elde bilenir. ".repeat(12)}</p>`,
  "<ul><li>Ceviz sap</li><li>Deri kılıf</li></ul>",
  '<p>Son söz: <a href="/sayfa/bakim">bakım rehberi</a>.</p>',
].join("")

const text = (over: Partial<ListingTextView> = {}): ListingTextView => ({
  html: LONG_HTML,
  paragraphs: [],
  look: { ...LISTING_TEXT_DEFAULTS },
  ...over,
})

const BOTTOM: HomeSectionView = {
  id: "alt-sss",
  type: "faq",
  title: "Sık sorulanlar",
  items: [{ question: "Kargo ne zaman?", answer: "Aynı gün." }],
} as unknown as HomeSectionView

const listing = (over: Partial<ListingPageView> = {}): ListingPageView => ({
  title: "Çakılar",
  description: [],
  breadcrumbs: [],
  subcategories: [],
  products: [],
  total: 9,
  pagination: {
    page: 1,
    pages: 2,
    previous: null,
    next: "/kategori/cakilar?sayfa=2",
    pagePath: { 1: "/kategori/cakilar", 2: "/kategori/cakilar?sayfa=2" },
  },
  sort: [],
  filters: [],
  price: null,
  active: [],
  clearPath: null,
  ...over,
})

const render = (view: ListingPageView) =>
  renderToStaticMarkup(createElement(atolyeTheme.ListingPage, { t, view }))

/** The text block's own element: its class list. */
const blockClass = (html: string) => /<div data-listing-text="" class="([^"]*)"/.exec(html)?.[1]

describe("the theme's listing text (adr/0075)", () => {
  it("draws the text after the list and its pages, not under the title; one h1", () => {
    const html = render(listing({ footText: text() }))
    expect(html.match(/<h1/g)).toHaveLength(1)
    const title = html.indexOf("</h1>")
    const pager = html.indexOf('href="/kategori/cakilar?sayfa=2"')
    const words = html.indexOf("<h2>Çelik seçimi</h2>")
    expect(pager).toBeGreaterThan(title)
    expect(words).toBeGreaterThan(pager)
    // Nothing of it in the header
    expect(html.slice(0, html.indexOf("</header>"))).not.toContain("Çelik seçimi")
  })

  it("comes before the category group's bottom sections", () => {
    const html = render(listing({ footText: text(), sectionsBottom: [BOTTOM] }))
    const words = html.indexOf("Çelik seçimi")
    const faq = html.indexOf("Kargo ne zaman?")
    expect(faq).toBeGreaterThan(-1)
    expect(words).toBeLessThan(faq)
  })

  it("prints the backend's HTML as it is, else the plain paragraphs as text", () => {
    expect(render(listing({ footText: text() }))).toContain(
      '<a href="/sayfa/bakim">bakım rehberi</a>'
    )
    const plain = render(
      listing({
        footText: text({ html: null, paragraphs: ["Birinci <b>paragraf</b>.", "İkinci."] }),
      })
    )
    expect(plain).toContain("<p>Birinci &lt;b&gt;paragraf&lt;/b&gt;.</p><p>İkinci.</p>")
  })

  it("draws nothing without a text, and none on a search", () => {
    expect(render(listing())).not.toContain("data-listing-text")
    expect(render(listing({ footText: null }))).not.toContain("data-listing-text")
    const search = render(
      listing({
        footText: text(),
        search: { suggestions: [], categories: [], brands: [] },
      })
    )
    expect(search).not.toContain("data-listing-text")
  })

  it("sizes on the type scale, aligns and measures as the shop chose", () => {
    const at = (look: Partial<ListingTextView["look"]>) =>
      blockClass(
        render(listing({ footText: text({ look: { ...LISTING_TEXT_DEFAULTS, ...look } }) }))
      )
    // The defaults: normal, from the start, the reading measure
    expect(at({})).toContain("text-md")
    expect(at({})).toContain("text-start")
    expect(at({})).toContain("max-w-[46rem]")
    expect(at({ size: "sm" })).toContain("text-sm")
    expect(at({ size: "lg" })).toContain("text-lg")
    expect(at({ align: "center" })).toMatch(/mx-auto text-center/)
    expect(at({ width: "wide" })).toContain("max-w-none")
    expect(at({ width: "wide" })).not.toContain("max-w-[46rem]")
  })

  it("folds a long text behind an accessible toggle, every word still in the HTML", () => {
    const html = render(listing({ footText: text() }))
    expect(html).toContain('class="gf-ltext flex flex-col gap-4" data-open="false"')
    expect(html).toMatch(
      /<button type="button" class="gf-btn gf-btn--quiet gf-btn--small gf-ltext-toggle self-start" aria-expanded="false" aria-controls="liste-metni">Devamını oku/
    )
    expect(html).toContain('id="liste-metni"')
    // The whole text, the last paragraph's link included
    expect(html).toContain("Son söz:")
    expect(html.match(/Her çakı atölyede/g)).toHaveLength(12)
    expect(html).not.toContain("display:none")
  })

  it("draws a short text open with no toggle, and a centred text's toggle in the middle", () => {
    const short = render(listing({ footText: text({ html: "<p>Kısa bir giriş.</p>" }) }))
    expect(short).toContain('data-open="true"')
    expect(short).not.toContain("gf-ltext-toggle")
    const centred = render(
      listing({ footText: text({ look: { ...LISTING_TEXT_DEFAULTS, align: "center" } }) })
    )
    expect(centred).toContain("gf-ltext-toggle self-center")
  })

  it("never folds when the shop turned folding off", () => {
    const html = render(
      listing({ footText: text({ look: { ...LISTING_TEXT_DEFAULTS, collapse: false } }) })
    )
    expect(html).toContain("<h2>Çelik seçimi</h2>")
    expect(html).not.toContain("gf-ltext")
    expect(html).not.toContain("Devamını oku")
  })

  it("keeps a landing page's intro under its title", () => {
    const html = render(listing({ description: ["Bayram için seçtiklerimiz."] }))
    const header = html.slice(0, html.indexOf("</header>"))
    expect(header).toContain("<p>Bayram için seçtiklerimiz.</p>")
  })
})
