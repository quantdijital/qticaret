import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderCatalogView, ShopView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { headerCatalogOf } from "../views/header-catalog"

/**
 * The catalog header strip's note (adr/0049 Ek 2026-11-15, adr/0066 §2):
 * a short line at the strip's start, a link when it goes somewhere; none,
 * the strip as drawn before it.
 */

const CATALOG: HeaderCatalogView = {
  searchPlaceholder: null,
  searchLabel: false,
  accountText: true,
  cartTotal: false,
  highlight: null,
  utilityBar: true,
  phone: true,
  categories: [],
  menuGround: "stage",
}

const catalogShop = (set: Partial<HeaderCatalogView> = {}, over: Partial<ShopView> = {}) =>
  shopFixture({
    headerBar: {
      id: "mainheader",
      variant: "catalog",
      sticky: true,
      catalog: { ...CATALOG, ...set },
    },
    ...over,
  })

/** The strip alone (its first closing `</div>` pair ends it: Container, then the strip). */
const stripOf = (html: string) =>
  /<div data-gf-strip=""[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? ""

const NOTE = "Kargo 1500 TL üzeri bedava"

describe("the catalog strip's note", () => {
  it("draws the strip as before without a note, absent or null", () => {
    const absent = renderFrame(atolyeTheme, catalogShop())
    expect(renderFrame(atolyeTheme, catalogShop({ stripNote: null }))).toBe(absent)
    const strip = stripOf(absent)
    // The links open it, "Hesabım" closes it: the markup from before the note
    expect(strip).toContain(
      '<nav aria-label="Kurumsal bağlantılar" class="-ml-3 flex flex-wrap items-center">'
    )
    expect(strip).toContain(
      '<a href="/hesap" class="-mr-3 ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-button px-3 font-semibold text-text no-underline pointer-coarse:min-h-11">'
    )
    expect(strip).not.toContain("truncate")
  })

  it("puts the note first, the links then at the end right before Hesabım", () => {
    const strip = stripOf(
      renderFrame(atolyeTheme, catalogShop({ stripNote: { text: NOTE, path: null } }))
    )
    expect(strip).toContain(`<p class="mr-auto min-w-0 truncate pr-3 text-text">${NOTE}</p>`)
    expect(strip).toContain(
      '<nav aria-label="Kurumsal bağlantılar" class="flex shrink-0 items-center">'
    )
    expect(strip).toMatch(
      /<a href="\/hesap" class="-mr-3 inline-flex min-h-9 shrink-0 items-center/
    )
    expect(strip).not.toContain("ml-auto")
    const at = (part: string) => strip.indexOf(part)
    expect(at(NOTE)).toBeLessThan(at('href="/hakkimizda"'))
    expect(at('href="/hakkimizda"')).toBeLessThan(at('href="/hesap"'))
    // Plain words: no link of its own
    expect(strip).not.toMatch(/<a [^>]*>Kargo/)
  })

  it("makes the note a link when it goes somewhere, its words escaped", () => {
    const strip = stripOf(
      renderFrame(
        atolyeTheme,
        catalogShop({ stripNote: { text: "<b>Fırsat</b> & indirim", path: "/kampanyalar" } })
      )
    )
    expect(strip).toContain(
      '<a href="/kampanyalar" class="mr-auto min-w-0 truncate pr-3 text-text leading-9 underline pointer-coarse:leading-11">&lt;b&gt;Fırsat&lt;/b&gt; &amp; indirim</a>'
    )
    expect(strip).not.toContain("<b>")
  })

  it("stands alone at the start when the top links are on the menu bar", () => {
    const html = renderFrame(
      atolyeTheme,
      catalogShop({ topLinksPlace: "bar", stripNote: { text: NOTE, path: null } })
    )
    const strip = stripOf(html)
    expect(strip).toContain(NOTE)
    expect(strip).not.toContain('href="/hakkimizda"')
    expect(strip).toMatch(/href="\/hesap"/)
    // The links once, on the menu bar
    expect(html.match(/href="\/hakkimizda"/g)).toHaveLength(1)
  })

  it("draws a strip for the note alone, and none without it", () => {
    const set = { toolsPlace: "row", topLinksPlace: "bar" } as const
    expect(renderFrame(atolyeTheme, catalogShop(set))).not.toContain("data-gf-strip")
    const strip = stripOf(
      renderFrame(atolyeTheme, catalogShop({ ...set, stripNote: { text: NOTE, path: null } }))
    )
    expect(strip).toContain(NOTE)
    expect(strip).not.toContain("<nav")
    expect(strip).not.toContain('href="/hesap"')
    // A strip turned off shows no note
    expect(
      renderFrame(
        atolyeTheme,
        catalogShop({ utilityBar: false, stripNote: { text: NOTE, path: null } })
      )
    ).not.toContain(NOTE)
  })

  it("keeps the links at the strip's very end when Hesabım is not there", () => {
    const strip = stripOf(
      renderFrame(
        atolyeTheme,
        catalogShop({ accountText: false, stripNote: { text: NOTE, path: null } })
      )
    )
    expect(strip).toContain(
      '<nav aria-label="Kurumsal bağlantılar" class="flex shrink-0 items-center -mr-3">'
    )
    expect(strip).not.toContain('href="/hesap"')
  })

  it("marks the note for the live editor only in its session", () => {
    const note = { stripNote: { text: NOTE, path: "/kampanyalar" } }
    expect(stripOf(renderFrame(atolyeTheme, catalogShop(note)))).not.toContain("data-qf")
    expect(stripOf(renderFrame(atolyeTheme, catalogShop(note, { editor: true })))).toContain(
      'data-qf="strip_note"'
    )
  })
})

describe("the strip's note as the storefront reads it", () => {
  const t = (key: string) => (key === "menu.system.sale" ? "Kampanyalar" : key)
  const read = (more: Record<string, unknown>) =>
    headerCatalogOf(
      {
        search_placeholder: null,
        search_label: false,
        account_text: true,
        cart_total: false,
        highlight_link: null,
        utility_bar: true,
        phone: true,
        categories_button: false,
        menu_ground: "stage",
        ...more,
      },
      t,
      () => []
    ).stripNote

  it("reads none from an older answer, a null or a blank one", () => {
    expect(read({})).toBeNull()
    expect(read({ strip_note: null, strip_note_link: null })).toBeNull()
    expect(read({ strip_note: "   " })).toBeNull()
  })

  it("takes the link's path, the note's words its name; a broken link leaves plain words", () => {
    expect(
      read({
        strip_note: NOTE,
        strip_note_link: { kind: "system", target: "sale", label: null, path: null },
      })
    ).toEqual({ text: NOTE, path: "/kampanyalar" })
    expect(read({ strip_note: NOTE, strip_note_link: null })).toEqual({ text: NOTE, path: null })
    // A record link the backend could not place: no path
    expect(
      read({
        strip_note: NOTE,
        strip_note_link: { kind: "category", target: "pcat_1", label: null, path: null },
      })
    ).toEqual({ text: NOTE, path: null })
  })
})
