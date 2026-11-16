import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { SearchSuggestView, SuggestState } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage, shopFixture } from "@/test/theme-render"
// The panel's states are drawn by a part the theme does not export
import {
  SearchPanel,
  panelOf,
  statusOf,
} from "../../../../../packages/themes/atolye/src/frame/SearchPanel"
import type { SearchPanelWords } from "../../../../../packages/themes/atolye/src/frame/SearchPanel"

/**
 * The header's live search in the Grafit theme: the first HTML is the
 * plain form (no combobox, no clear button: both need the script), and
 * the panel's states as the field draws them: loading rows, the hits
 * with their prices and help as listbox options, the empty answer with
 * the shop's categories, a quiet failure.
 */

const words: SearchPanelWords = {
  results: t("search.help"),
  products: t("search.suggest.products"),
  categories: t("search.suggest.categories"),
  brands: t("search.suggest.brands"),
  phrases: t("search.suggest.phrases"),
  all: t("search.suggest.all"),
  none: t("search.suggest.none"),
  browse: t("search.suggest.browse"),
  loading: t("search.suggest.loading"),
  error: t("search.suggest.error"),
  found: t("search.suggest.found"),
  priceBefore: t("price.before"),
  from: t("price.from"),
}

const BROWSE = [
  { label: "Çakılar", path: "/kategori/cakilar" },
  { label: "Aksesuar", path: "/kategori/aksesuar" },
]

const answer: SearchSuggestView = {
  q: "çakı",
  total: 74,
  allPath: "/arama?q=%C3%A7ak%C4%B1",
  products: [
    {
      id: "p1",
      title: "Katlanır Çakı",
      path: "/urun/katlanir-caki",
      image: {
        src: "/media/caki.jpg",
        alt: "Katlanır çakı",
        width: 800,
        height: 800,
        sources: { avif: null, webp: null },
      },
      price: { current: "875,00 TL", before: "1.250,00 TL", from: false, discount: 30 },
    },
    {
      id: "p2",
      title: "Bileme Taşı",
      path: "/urun/bileme-tasi",
      image: null,
      price: { current: "120,00 TL", before: null, from: true, discount: null },
    },
  ],
  categories: [{ label: "Çakılar", path: "/kategori/cakilar" }],
  brands: [{ label: "Yatağan", path: "/arama?q=%C3%A7ak%C4%B1&marka=yatagan" }],
  suggestions: [],
}

const draw = (state: SuggestState, active = -1) =>
  renderToStaticMarkup(
    createElement(SearchPanel, {
      model: panelOf(state, BROWSE),
      words,
      listboxId: "liste",
      optionId: (index: number) => `secenek-${String(index)}`,
      active,
      hidden: false,
    })
  )

describe("the theme's live search", () => {
  it("prints the plain search form first: no combobox, no clear button before the script", () => {
    const html = renderPage(atolyeTheme, "Layout", {
      shop: shopFixture(),
      children: createElement("p", null, "Sayfa"),
      saveCookies: () => Promise.resolve(),
      searchSuggest: "/api/search/suggest",
    })
    // One: the wide screen's; a phone's drops from the bottom bar's "Ara" (owner 2026-11-16)
    expect(html.match(/action="\/arama"/g)).toHaveLength(1)
    expect(html.match(/type="search"/g)).toHaveLength(1)
    expect(html).not.toContain('role="combobox"')
    expect(html).not.toContain("Aramayı temizle")
    expect(html).not.toContain('role="listbox"')
  })

  it("draws nothing below two characters, loading rows while the first answer comes", () => {
    expect(panelOf({ status: "idle" }, BROWSE)).toBeNull()
    const loading = draw({ status: "loading", q: "ça", view: null })
    expect(loading).toContain("animate-pulse")
    expect(loading).toMatch(/<div role="listbox" id="liste"[^>]*hidden=""/)
    expect(statusOf(panelOf({ status: "loading", q: "ça", view: null }, BROWSE), words)).toBe(
      "Aranıyor…"
    )
  })

  it("lists the hits with photo, name and the card's price, the help, and every result last", () => {
    const state: SuggestState = { status: "ready", q: "çakı", view: answer }
    const html = draw(state, 0)
    // Each option a link the arrow keys reach; the first one on
    expect(html).toMatch(
      /<a role="option" id="secenek-0" href="\/urun\/katlanir-caki" aria-selected="true" tabindex="-1"/
    )
    expect(html).toContain('<div role="group" aria-label="Ürünler"')
    expect(html).toContain('src="/media/caki.jpg"')
    expect(html).toContain("875,00 TL")
    expect(html).toMatch(/<s[^>]*><span class="sr-only">Önceki fiyat: <\/span>1.250,00 TL<\/s>/)
    expect(html).toContain("120,00 TL&#x27;den başlayan")
    expect(html).toContain('aria-label="Kategoriler"')
    expect(html).toContain('href="/arama?q=%C3%A7ak%C4%B1&amp;marka=yatagan"')
    expect(html).toContain(">Tüm sonuçları gör (74)</a>")
    expect(panelOf(state, BROWSE)?.paths).toEqual([
      "/urun/katlanir-caki",
      "/urun/bileme-tasi",
      "/kategori/cakilar",
      "/arama?q=%C3%A7ak%C4%B1&marka=yatagan",
      "/arama?q=%C3%A7ak%C4%B1",
    ])
    expect(statusOf(panelOf(state, BROWSE), words)).toBe(
      "5 öneri var, ok tuşlarıyla gezinebilirsiniz."
    )
  })

  it("keeps the last answer dimmed while the next loads", () => {
    const html = draw({ status: "loading", q: "çakıl", view: answer })
    expect(html).toMatch(/role="listbox"[^>]*aria-busy="true"[^>]*class="[^"]*opacity-60/)
    expect(html).toContain("Katlanır Çakı")
  })

  it("says nothing was found and offers the shop's categories", () => {
    const empty: SearchSuggestView = {
      ...answer,
      q: "zzqq",
      total: 0,
      allPath: "/arama?q=zzqq",
      products: [],
      categories: [],
      brands: [],
    }
    const html = draw({ status: "ready", q: "zzqq", view: empty })
    expect(html).toContain("“zzqq” için sonuç bulunamadı")
    expect(html).toContain('aria-label="Kategorilere göz atın"')
    expect(html).toContain('href="/kategori/aksesuar"')
    expect(html).not.toContain("Tüm sonuçları gör")
  })

  it("fails quietly: one line, no options, the form still submits", () => {
    const html = draw({ status: "error", q: "çakı" })
    expect(html).toContain("Öneriler şu an gösterilemiyor. Aramak için Enter&#x27;a basın.")
    expect(html).not.toContain('role="option"')
  })
})
