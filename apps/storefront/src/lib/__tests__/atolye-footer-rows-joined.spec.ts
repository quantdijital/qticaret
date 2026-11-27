import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { FooterBlockView, FooterRowView, FooterRowsView, ShopView } from "@qticaret/ui"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage, shopFixture } from "@/test/theme-render"

/**
 * The free rows footer's two settings that keep a brand columns design as
 * it was (adr/0070 §4 Ek): the footer group's newsletter band on the
 * footer's ground (`joined`), the brand block's address under its line.
 */

const FREE: FooterRowsView = {
  ground: "well",
  badgeStyle: "card",
  legalPlace: "strip",
  bottomBadges: true,
}
const ADDRESS = "Örnek Mah. 1. Sok. No: 1, Denizli"

const brand = (address: string | null): FooterBlockView => ({
  id: "footerbrand",
  at: 0,
  device: "all",
  type: "brand",
  logo: null,
  logoSize: "medium",
  name: "Örnek Atölye",
  about: "Kısa tanıtım.",
  social: [],
  address,
})

const row = (blocks: FooterBlockView[]): FooterRowView => ({
  id: "satir00001",
  layout: "2-1-1-1",
  ground: "inherit",
  space: "medium",
  align: "start",
  phoneColumns: 1,
  divider: true,
  columns: [{ blocks }, { blocks: [] }, { blocks: [] }, { blocks: [] }],
})

const BAND = {
  title: "Yeni modeller e-postanızda",
  text: "E-posta almayı kabul ediyorum.",
  variant: "split" as const,
  description: "Ayda birkaç kez haber veririz.",
  note: "İstediğiniz an ayrılırsınız.",
  image: null,
}

const shopWith = (newsletter: ShopView["newsletter"], free = FREE, address: string | null = null) =>
  shopFixture({
    footerBar: {
      id: "mainfooter",
      variant: "free_rows",
      freeRows: free,
      rows: [row([brand(address)])],
    },
    newsletter,
    footerSections: [],
  })

const footerOf = (html: string) => html.slice(html.indexOf("<footer"))

const draw = (shop: ShopView) =>
  footerOf(
    renderPage(atolyeTheme, "Layout", {
      shop,
      children: createElement("p", null, "Sayfa"),
      saveCookies: () => Promise.resolve(),
      subscribe: () => Promise.resolve({ ok: true as const }),
    } as never)
  )

describe("the free rows footer's joined newsletter band", () => {
  it("draws the band on the footer's ground, its top band under a rule, before the rows", () => {
    const html = draw(shopWith({ ...BAND, joined: true }))
    expect(html).toContain('<div data-footer-band="" class="border-b border-rule">')
    expect(html).toContain("Yeni modeller e-postanızda")
    expect(html).toContain("İstediğiniz an ayrılırsınız.")
    expect(html).toContain('id="bulten-alt-eposta"')
    expect(html.indexOf("data-footer-band")).toBeLessThan(html.indexOf('class="gf-frow'))
  })

  it("leaves the band out of the footer while the setting is off", () => {
    const html = draw(shopWith(BAND))
    expect(html).not.toContain("data-footer-band")
    expect(html).not.toContain("Yeni modeller e-postanızda")
  })

  it("turns the band dark on the stage", () => {
    const html = draw(shopWith({ ...BAND, joined: true }, { ...FREE, ground: "stage" }))
    expect(html).toContain('<div data-footer-band="" class="border-b border-rule gf-stage">')
  })

  it("draws no band for a box that is not one, joined or not", () => {
    const html = draw(shopWith({ ...BAND, variant: "in_footer", joined: true }))
    expect(html).not.toContain("data-footer-band")
  })
})

describe("the free rows footer's brand block address", () => {
  it("shows the address under the short line when the block keeps it", () => {
    const html = draw(shopWith(null, FREE, ADDRESS))
    expect(html).toContain(ADDRESS)
    expect(html.indexOf("Kısa tanıtım.")).toBeLessThan(html.indexOf(ADDRESS))
  })

  it("shows none while the block leaves it out", () => {
    expect(draw(shopWith(null))).not.toContain(ADDRESS)
  })
})

describe("the free rows grid on a tablet", () => {
  it("gives a 2-1-1-1 row's wide column the whole width, the narrow three beside each other", () => {
    const css = atolyeCss("footer-rows.css")
    expect(css).toContain("@media (min-width: 48rem) and (max-width: 63.999rem)")
    expect(css).toContain('.gf-frow-grid[data-layout="2-1-1-1"] > .gf-fcol:first-child')
  })
})
