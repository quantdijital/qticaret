import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  HomeSectionView,
  ListingPageView,
  ProductCardView,
  SearchFormView,
} from "@qticaret/ui"
import { SEARCH_FORM_DEFAULTS } from "@qticaret/types/search-form"
import type { SearchFormSettings } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { EMPTY_VALUES, searchFormView } from "@/lib/views/search-form"
import type { SearchFormSource } from "@/lib/views/search-form"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0077 §1 and §4 as Atölye draws them: the shop's one search box as a
 * plain GET form whose fields follow the theme setting and the dated
 * products flag (the bar or tabs over it), in a `search_box` section and
 * over `/arama`; a date search's card says its departure is in the dates
 * and its few places left.
 */

const source = (settings: Partial<SearchFormSettings> = {}, booking = true): SearchFormSource => ({
  settings: { ...SEARCH_FORM_DEFAULTS, attribute_key: "gidilecek_yer", ...settings },
  booking,
  categories: [
    { handle: "kultur", name: "Kültür turları" },
    { handle: "doga", name: "Doğa turları" },
  ],
  where: { label: "Gidilecek yer", options: [{ value: "kapadokya", label: "Kapadokya" }] },
  today: "2026-11-23",
})

const form = (settings: Partial<SearchFormSettings> = {}, booking = true): SearchFormView =>
  searchFormView(source(settings, booking), EMPTY_VALUES, t)

const box = (view: SearchFormView, title: string | null = "Turunu bul"): HomeSectionView => ({
  id: "arama01",
  type: "search_box",
  title,
  intro: title ? "Ne zaman, nereye, kaç kişi?" : null,
  form: view,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const names = (html: string) =>
  [...html.matchAll(/<(?:input|select)[^>]*?name="([^"]+)"/g)].map((match) => match[1])

const listing = (over: Partial<ListingPageView> = {}): ListingPageView => ({
  title: "Kapadokya · 1–10 Ara",
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
  ...over,
})

const renderListing = (view: ListingPageView) =>
  renderToStaticMarkup(createElement(atolyeTheme.ListingPage, { view, t }))

describe("Atölye's search box", () => {
  it("is a GET form to /arama that works without JavaScript, every field by its own name", () => {
    const html = home([box(form())])

    const tag = /<form[^>]*>/.exec(html)?.[0] ?? ""
    expect(tag).toContain('action="/arama"')
    expect(tag).toContain('method="get"')
    expect(tag).toContain('role="search" aria-label="Ürün ara"')
    expect(names(html)).toEqual([
      "kategori",
      "gidilecek_yer",
      "tarih_baslangic",
      "tarih_bitis",
      "ay",
      "kisi",
    ])
    expect(html).toContain('type="date"')
    expect(html).toContain('min="2026-11-23"')
    expect(html).toContain('<button type="submit"')
    expect(html).toContain("Ara</button>")
    // The section's own words over it
    expect(html).toContain("Turunu bul</h2>")
    expect(html).toContain('role="group" aria-label="Tarih"')
  })

  it("draws no dates nor party for a shop that sells no dated products", () => {
    const html = home([box(form({}, false))])
    expect(names(html)).toEqual(["kategori", "gidilecek_yer"])
  })

  it("leaves out each field the shop turns off; a words field without a where attribute", () => {
    const off = home([
      box(form({ show_category: false, show_dates: false, show_people: false }), null),
    ])
    expect(names(off)).toEqual(["gidilecek_yer"])
    // No heading: the section takes the form's name
    expect(off).toContain('aria-label="Ürün ara" class="gf-section"')
    const plain = home([box(form({ attribute_key: null, show_dates: false, show_people: false }))])
    expect(names(plain)).toEqual(["q", "kategori"])
    expect(plain).toContain('type="search"')
  })

  it("boxes each field apart only when the shop turns boxed fields on", () => {
    expect(home([box(form())])).not.toContain("data-fields")
    expect(form().boxed).toBeUndefined()
    const html = home([box(form({ boxed_fields: true }))])
    expect(html).toContain('data-fields="boxed"')
    expect(names(html)).toEqual(names(home([box(form())])))
    expect(atolyeCss("styles.css")).toContain('@import "./search-boxed.css";')
  })

  it("offers the categories as tabs over the bar: a radio group, the empty choice first", () => {
    const html = home([box(form({ category_style: "tabs" }))])

    expect(html).toMatch(/<fieldset[^>]*><legend class="sr-only">Kategori<\/legend>/)
    const radios = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((match) => match[0])
    expect(radios.map((radio) => /value="([^"]*)"/.exec(radio)?.[1])).toEqual([
      "",
      "kultur",
      "doga",
    ])
    expect(radios.every((radio) => radio.includes('name="kategori"'))).toBe(true)
    expect(radios[0]).toContain("checked")
    expect(html).not.toContain('<select name="kategori"')
    // No icon picked: a tab is its name alone
    const tabs = [...html.matchAll(/<label class="relative cursor-pointer">(.*?)<\/label>/g)]
    expect(tabs.every((tab) => !tab[1]?.includes("<svg"))).toBe(true)
  })

  it('draws a tab\'s icon before its name, and without "Tümü" the first tab chosen', () => {
    const view = form({ category_style: "tabs", tab_all: false })
    const options = view.category?.options.map((option, at) =>
      at === 0 ? { ...option, icon: "compass" as const } : option
    )
    const html = home([
      box({ ...view, category: view.category && { ...view.category, options: options ?? [] } }),
    ])
    const radios = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((match) => match[0])
    expect(radios.map((radio) => /value="([^"]*)"/.exec(radio)?.[1])).toEqual(["kultur", "doga"])
    expect(radios[0]).toContain("checked")
    const tabs = [...html.matchAll(/<label class="relative cursor-pointer">(.*?)<\/label>/g)]
    expect(tabs[0]?.[1]).toMatch(/<span class="[^"]*flex items-center gap-2[^"]*"><svg/)
    expect(tabs[1]?.[1]).not.toContain("<svg")
  })

  it("stands over a search's results with the values asked, its words carried unseen", () => {
    const view = searchFormView(
      source(),
      {
        q: "balon",
        filters: [["gidilecek_yer", ["kapadokya"]]],
        dated: { category: "doga", range: "2026-12-01_2026-12-10", months: null, pax: 2 },
      },
      t
    )
    const html = renderListing(listing({ searchForm: view }))

    expect(html).toContain('<input type="hidden" name="q" value="balon"/>')
    expect(html).toMatch(/<option value="kapadokya" selected="">Kapadokya<\/option>/)
    expect(html).toMatch(/<option value="doga" selected="">Doğa turları<\/option>/)
    expect(html).toContain('value="2026-12-01"')
    expect(html).toMatch(/<option value="2" selected="">2 kişi<\/option>/)
  })

  it("is not drawn on a list without one", () => {
    expect(renderListing(listing())).not.toContain('role="search"')
  })
})

const tour = (booking: NonNullable<ProductCardView["booking"]>): ProductCardView => ({
  id: "prod_1",
  title: "Kapadokya turu",
  path: "/urun/kapadokya-turu",
  brand: null,
  image: null,
  price: { current: "1.750,00 TL", before: null, from: true, discount: null },
  available: true,
  booking,
})

describe("Atölye's card in a date search (adr/0077 §4)", () => {
  it("says the departure is in the dates asked and its few places left", () => {
    const html = renderListing(
      listing({
        total: 1,
        products: [
          tour({ next: "12 Ara", nextAt: "2026-12-12T06:00:00.000Z", left: 3, inRange: true }),
        ],
      })
    )
    expect(html).toContain("Tarihlerinizde: 12 Ara</time>")
    expect(html).toContain("Son 3 yer")
  })

  it("reads as before without them", () => {
    const html = renderListing(
      listing({
        total: 1,
        products: [tour({ next: "12 Ara", nextAt: "2026-12-12T06:00:00.000Z" })],
      })
    )
    expect(html).toContain("En yakın: 12 Ara</time>")
    expect(html).not.toContain("Son ")
  })
})
