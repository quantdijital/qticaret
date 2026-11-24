import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ListingPageView, SearchFormView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0077 §7 as Atölye draws it: under the search box, while the shop
 * reads sentences, the words that say not to write personal details;
 * over a read search's results, "Anladığım:" and each part a nofollow
 * link that takes it away. Off (the default): not a byte more.
 */

const FORM: SearchFormView = {
  action: "/arama",
  label: "Ürün ara",
  submit: "Ara",
  hidden: [],
  words: { name: "q", label: "Ne arıyorsunuz?", placeholder: "", value: "" },
  category: null,
  where: null,
  dates: null,
  people: null,
}
const HINT = t("search.natural_hint")

const box = (hint?: string): HomeSectionView => ({
  id: "arama01",
  type: "search_box",
  title: "Turunu bul",
  intro: null,
  form: FORM,
  ...(hint === undefined ? {} : { hint }),
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const listing = (over: Partial<ListingPageView> = {}): ListingPageView => ({
  title: "Kapadokya",
  description: [],
  breadcrumbs: [],
  subcategories: [],
  products: [],
  total: 0,
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: { 1: "/arama" } },
  sort: [],
  filters: [],
  price: null,
  active: [],
  clearPath: null,
  search: null,
  searchForm: FORM,
  ...over,
})

const renderListing = (view: ListingPageView) =>
  renderToStaticMarkup(createElement(atolyeTheme.ListingPage, { view, t }))

describe("Atölye's search in the shopper's own words", () => {
  it("the box's hint only while on; off, the section is as before", () => {
    expect(home([box(HINT)])).toContain("Kişisel bilgi (ad, telefon, adres) yazmayın.")
    const off = home([box()])
    expect(off).not.toContain("Kişisel bilgi")
    expect(off).toBe(home([box(undefined)]))
  })

  it("/arama's hint under its box; none without it", () => {
    expect(renderListing(listing({ searchHint: HINT }))).toContain("Kişisel bilgi")
    const off = renderListing(listing())
    expect(off).not.toContain("Kişisel bilgi")
    expect(renderListing(listing({ searchHint: null }))).toBe(off)
  })

  it("Anladığım: each part a nofollow link that takes it away, named for a screen reader", () => {
    const html = renderListing(
      listing({
        understood: {
          title: "Anladığım:",
          parts: [
            {
              label: "Kapadokya",
              path: "/arama?kisi=2&_anlam=1",
              remove: "Filtreyi kaldır: Kapadokya",
            },
          ],
        },
      })
    )
    expect(html).toContain("Anladığım:")
    const link = /<a[^>]*href="\/arama\?kisi=2&amp;_anlam=1"[^>]*>/.exec(html)?.[0] ?? ""
    expect(link).toContain('rel="nofollow"')
    expect(link).toContain('aria-label="Filtreyi kaldır: Kapadokya"')
    expect(renderListing(listing({ understood: null }))).not.toContain("Anladığım")
  })
})
