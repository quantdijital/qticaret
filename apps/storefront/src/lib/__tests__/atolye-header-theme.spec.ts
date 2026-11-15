import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { NavCategoryView, ShopView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * The header's two variants and the aisle's dropdown (owner's "M1",
 * 2026-11-15) as the server prints them: the centred header's search,
 * wordmark and tools in that order on both breakpoints' markup, the
 * dropdown's rows with their pictures and counts, "Tümünü gör" with the
 * category's own count, and no pill where the storefront gave no count.
 */

const photo = (src: string) => ({
  src,
  alt: "",
  width: 400,
  height: 400,
  sources: { avif: null, webp: null },
})

const COUNTED: NavCategoryView[] = [
  {
    label: "Çakılar",
    path: "/kategori/cakilar",
    count: 1240,
    children: [
      {
        label: "Katlanır çakılar",
        path: "/kategori/cakilar/katlanir",
        count: 5,
        image: photo("/media/katlanir.jpg"),
      },
      { label: "Sabit çakılar", path: "/kategori/cakilar/sabit" },
    ],
  },
  { label: "Aksesuar", path: "/kategori/aksesuar", count: 24, children: [] },
]

const centred = (over: Partial<ShopView> = {}) =>
  renderFrame(
    atolyeTheme,
    shopFixture({ headerBar: { id: "mainheader", variant: "centered", sticky: true }, ...over })
  )

/** The header's own markup, the page and footer left out. */
const headerOf = (html: string) => html.slice(html.indexOf("<header"), html.indexOf("</header>"))

/** One dropdown row's markup, by its link. */
const rowOf = (html: string, path: string) => {
  const match = new RegExp(`<a [^>]*href="${path}"[^>]*class="gf-drop-row"[^>]*>(.*?)</a>`).exec(
    html
  )
  if (!match?.[1]) {
    throw new Error(`No dropdown row for ${path}`)
  }
  return match[1]
}

describe("the centred header (header bar `centered`)", () => {
  it("puts the search on the left, the wordmark in the middle and the tools on the right", () => {
    const head = headerOf(centred())
    // The section mark (`data-qs`, sectionMark) may sit between the hook and the class
    expect(head).toMatch(
      /<header data-gf-head=""(?: data-qs="[^"]*")? class="[^"]*gf-head sticky top-0[^"]*"/
    )
    expect(head).toContain('data-variant="centered"')
    expect(head).toMatch(
      /class="[^"]*grid h-14 grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\][^"]*lg:h-20[^"]*" data-gf-head-row=""/
    )
    // The wide search 22 rem at most, from 1024 px only
    expect(head).toMatch(/<form[^>]*class="relative hidden flex-1 lg:block max-w-88"/)
    // The keyboard's order: the search, the wordmark, then account, favourites and cart
    const search = head.indexOf('id="arama-genis"')
    const mark = head.indexOf("Örnek Atölye</span>")
    const account = head.indexOf('href="/hesap"')
    const cart = head.indexOf('aria-label="Sepet, 2 ürün"')
    expect(search).toBeGreaterThan(-1)
    expect(search).toBeLessThan(mark)
    expect(mark).toBeLessThan(account)
    expect(account).toBeLessThan(cart)
    expect(head).toMatch(/<a href="\/"[^>]*class="[^"]*justify-self-center/)
    expect(head).toMatch(/<nav aria-label="Hesabım" class="[^"]*justify-self-end/)
    // The aisle centred under the row
    expect(head).toMatch(/<ul[^>]*class="flex flex-wrap items-center gap-x-1 justify-center"/)
  })

  it("on a phone: the menu on the left, the wordmark, favourites and cart, the search under them", () => {
    const head = headerOf(centred())
    const menu = head.indexOf('aria-label="Menüyü aç"')
    const mark = head.indexOf("Örnek Atölye</span>")
    const favourites = head.indexOf('href="/hesap/favoriler"')
    const phoneSearch = head.indexOf('id="arama-dar"')
    expect(menu).toBeGreaterThan(-1)
    expect(menu).toBeLessThan(mark)
    expect(mark).toBeLessThan(favourites)
    expect(favourites).toBeLessThan(phoneSearch)
    // The menu button is the phone's; the account waits for 1024 px
    expect(head).toMatch(/aria-label="Menüyü aç"[^>]*class="gf-icon-btn -ml-2.5 lg:hidden"/)
    expect(head).toMatch(/<a href="\/hesap" aria-label="Hesabım" class="[^"]*max-lg:hidden/)
    expect(head).toMatch(/<div class="[^"]*pb-2 lg:hidden"><form/)
    // The skip link still leads the page
    expect(centred()).toMatch(/^<div[^>]*><a href="#icerik" class="gf-skip">/)
  })

  it("keeps the standard header as it was: the wordmark first, the wide search, the aisle from the start", () => {
    const head = headerOf(renderFrame(atolyeTheme, shopFixture()))
    expect(head).toContain('data-variant="standard"')
    expect(head).toMatch(
      /class="[^"]*gf-head-row flex h-14 items-center gap-1 lg:h-20 lg:gap-\(--space-xl\)" data-gf-head-row=""/
    )
    expect(head.indexOf("Örnek Atölye</span>")).toBeLessThan(head.indexOf('id="arama-genis"'))
    expect(head).toMatch(/<form[^>]*class="relative hidden flex-1 lg:block max-w-160"/)
    expect(head).toMatch(/<ul[^>]*class="flex flex-wrap items-center gap-x-1 -ml-3"/)
    expect(head).not.toContain("justify-self-center")
  })
})

describe("the aisle's dropdown (M1)", () => {
  it("lists each child as a row: its 40 px picture, its name and its count, read as products", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ categories: COUNTED }))
    const row = rowOf(html, "/kategori/cakilar/katlanir")
    expect(row).toMatch(
      /<span class="block shrink-0 overflow-hidden rounded-inner bg-media-deep size-10">/
    )
    expect(row).toContain('src="/media/katlanir.jpg"')
    expect(row).toContain("<span>Katlanır çakılar</span>")
    expect(row).toContain(
      '<span class="gf-menu-count"><span aria-hidden="true">5</span><span class="sr-only">5 ürün</span></span>'
    )
  })

  it("shows no pill on a row the storefront did not count, never a guessed number", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ categories: COUNTED }))
    const row = rowOf(html, "/kategori/cakilar/sabit")
    expect(row).toContain("<span>Sabit çakılar</span>")
    expect(row).not.toContain("gf-menu-count")
    // A picture-less row keeps its empty square, so the names line up
    expect(row).toMatch(/size-10"><\/span>/)
  })

  it('ends on "Tümünü gör" with the category\'s count in the dark pill, heard with the name', () => {
    const html = renderFrame(atolyeTheme, shopFixture({ categories: COUNTED }))
    const all =
      /<a [^>]*href="\/kategori\/cakilar"[^>]*class="gf-drop-row gf-drop-all"[^>]*>(.*?)<\/a>/.exec(
        html
      )?.[1]
    expect(all).toContain('<span aria-hidden="true">Tümünü gör</span>')
    expect(all).toContain('<span class="sr-only">Tümünü gör: Çakılar</span>')
    expect(all).toContain(
      '<span class="gf-menu-count gf-menu-count--dark"><span aria-hidden="true">1.240</span><span class="sr-only">1.240 ürün</span></span>'
    )
  })

  it("keeps the counts out without an answer, and a category without children a plain link", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html).not.toContain("gf-menu-count")
    expect(html).toContain('class="gf-drop-row gf-drop-all"')
    expect(html).toMatch(
      /<a [^>]*href="\/kategori\/aksesuar"[^>]*class="gf-aisle-item group inline-flex[^>]*>Aksesuar<\/a>/
    )
    // Closed in the first HTML, its links there for a crawler
    expect(html).toMatch(
      /<div[^>]*data-state="closed"[^>]*data-gf-drop="\/kategori\/cakilar"|data-gf-drop="\/kategori\/cakilar"[^>]*data-state="closed"/
    )
  })

  it("is the centred header's menu too", () => {
    const html = centred({ categories: COUNTED })
    expect(rowOf(html, "/kategori/cakilar/katlanir")).toContain("5 ürün")
    expect(html).toContain('class="gf-drop-row gf-drop-all"')
  })
})
