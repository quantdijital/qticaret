import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { FooterBlockView, FooterRowView, FooterRowsView, ShopView } from "@qticaret/ui"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage, shopFixture } from "@/test/theme-render"

/**
 * The free rows footer's later steps (adr/0066: each a step, today's look
 * its default): the legal texts in the bottom line, the quiet ways to pay,
 * the five-column split, a text in the hand face, a taller logo and the
 * bare profile icons.
 */

const FREE: FooterRowsView = {
  ground: "page",
  badgeStyle: "card",
  legalPlace: "strip",
  bottomBadges: true,
}

const at = (place: number) => ({
  id: `blok${String(place).padStart(5, "0")}`,
  at: place,
  device: "all" as const,
})

const BLOCKS: FooterBlockView[] = [
  {
    ...at(0),
    type: "brand",
    logo: null,
    logoSize: "large",
    name: "Örnek Atölye",
    about: null,
    social: [],
    address: null,
  },
  {
    ...at(1),
    type: "social",
    title: null,
    profiles: [{ network: "instagram", label: "Instagram", href: "https://instagram.com/ornek" }],
  },
  { ...at(2), type: "text", title: null, html: "<p>Keşfet<br>Yola çık</p>", style: "hand" },
]

const contact = (iconStyle: "boxed" | "inline"): FooterBlockView => ({
  ...at(3),
  type: "contact",
  title: null,
  address: null,
  phone: "0532 000 00 00",
  phoneHref: "tel:+905320000000",
  whatsappHref: null,
  email: "merhaba@anadolurotalari.example",
  hours: [],
  iconStyle,
})

const row = (icons: "boxed" | "inline" = "boxed"): FooterRowView => ({
  id: "satir00001",
  layout: "2-1-1-1-1",
  ground: "inherit",
  space: "medium",
  align: "start",
  phoneColumns: 1,
  divider: false,
  columns: [
    { blocks: BLOCKS.slice(0, 1) },
    { blocks: BLOCKS.slice(1, 2) },
    { blocks: [] },
    { blocks: [contact(icons)] },
    { blocks: BLOCKS.slice(2) },
  ],
})

const draw = (
  free: FooterRowsView,
  over: Partial<ShopView> = {},
  icons: "boxed" | "inline" = "boxed"
) => {
  const shop = shopFixture({
    footerBar: {
      id: "mainfooter",
      variant: "free_rows",
      freeRows: free,
      rows: [row(icons)],
      social: "bare",
    },
    ...over,
  })
  const html = renderPage(atolyeTheme, "Layout", {
    shop,
    children: createElement("p", null, "Sayfa"),
    saveCookies: () => Promise.resolve(),
    subscribe: () => Promise.resolve({ ok: true as const }),
  } as never)
  return html.slice(html.indexOf("<footer"))
}

describe("the free rows footer's later steps", () => {
  it("keeps the legal strip by default and moves the legal texts beside the year on `bottom_line`", () => {
    const strip = draw(FREE)
    expect(strip).toContain('data-legal="strip"')
    expect(strip.indexOf('<nav aria-label="Yasal metinler"')).toBeLessThan(strip.indexOf("©"))
    const line = draw({ ...FREE, legalPlace: "bottom_line" })
    expect(line).toContain('data-legal="bottom_line"')
    const bottom = line.slice(line.indexOf("©"))
    expect(bottom).toContain('<nav aria-label="Yasal metinler"')
    expect(bottom).toContain('href="/cerez-tercihleri"')
    // The identity lines the law asks for stay
    expect(line).toContain("MERSİS: 0000000000000000")
  })

  it("draws a hand text and bare icons on the five-column split", () => {
    const html = draw({ ...FREE, badgeStyle: "muted" })
    expect(html).toContain('data-badges="muted"')
    expect(html).toContain('data-layout="2-1-1-1-1"')
    expect(html).toMatch(
      /class="gf-foot-prose[^"]*font-\(family-name:--font-accent\)[^"]*" data-style="hand"/
    )
    expect(html).not.toContain("border border-rule bg-field no-underline")
  })

  it("keeps the contact's round signs by default and draws them small in the line on `inline`", () => {
    const boxed = draw(FREE)
    expect(boxed).toContain('class="gf-reach-sign"')
    expect(boxed).not.toContain('data-icons="inline"')
    const inline = draw(FREE, {}, "inline")
    expect(inline).toContain('data-icons="inline"')
    expect(inline).not.toContain('class="gf-reach-sign"')
    // The kind read out only, the address in the line
    expect(inline).toContain('<span class="sr-only">Telefon: </span>')
    // A narrow column breaks the e-mail after its @, never mid-word
    for (const html of [boxed, inline]) {
      expect(html).toContain("merhaba@<wbr/>anadolurotalari.example")
    }
  })

  it("keeps its grid and quiet marks in the theme's stylesheet", () => {
    const css = atolyeCss("footer-rows-line.css")
    expect(css).toContain('.gf-frow-grid[data-layout="2-1-1-1-1"]')
    expect(css).toContain('.gf-footer-rows[data-badges="muted"] .gf-pay > li')
    expect(css).toContain('.gf-footer-rows[data-legal="bottom_line"] .gf-foot-line')
  })
})
