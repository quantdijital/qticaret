import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { FooterBlockView, FooterRowView, FooterRowsView, ShopView } from "@qticaret/ui"
import { atolyeCss } from "@/test/atolye-css"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The free rows footer (adr/0070): rows of a ready-made split, each column
 * a stack of blocks, then the legal strip and the bottom line, which no
 * layout takes away. Field marks only in the theme editor's live preview.
 */

const FREE: FooterRowsView = { ground: "well", badgeStyle: "card", bottomBadges: true }

const IMAGE = {
  src: "https://cdn.example.com/rozet.webp",
  alt: "Yerli üretim rozeti",
  width: 400,
  height: 200,
  sources: { avif: null, webp: "https://cdn.example.com/rozet-400.webp 400w" },
}

const at = (n: number) => ({ id: `blok${String(n)}abc`, at: n, device: "all" as const })

const BLOCKS: FooterBlockView[] = [
  {
    ...at(0),
    type: "brand",
    logo: null,
    name: "Örnek Atölye",
    about: "Kısa tanıtım.",
    social: [],
    address: null,
  },
  {
    ...at(1),
    type: "menu",
    title: "Kurumsal",
    links: [{ label: "Hakkımızda", path: "/hakkimizda" }],
    collapsePhone: true,
  },
  {
    ...at(2),
    type: "menu",
    title: "Yardım",
    links: [{ label: "SSS", path: "/sss" }],
    collapsePhone: false,
  },
  {
    ...at(3),
    type: "contact",
    title: "Bize ulaşın",
    address: "Örnek Mah. 1. Sok. No: 1, Denizli",
    phone: "0532 000 00 00",
    phoneHref: "tel:+905320000000",
    whatsappHref: null,
    email: "bilgi@example.com",
    hours: [{ days: "Pazartesi – Cuma", hours: "09:00 – 18:00" }],
  },
  {
    ...at(4),
    type: "text",
    title: "Kargo",
    html: '<p>Aynı gün <a href="https://example.com/a" rel="noopener noreferrer">kargo</a>.</p>',
  },
  {
    ...at(5),
    type: "newsletter",
    title: "Yenilikler e-postanızda",
    consent: "E-posta almayı kabul ediyorum.",
    description: null,
    variant: "in_footer",
  },
  {
    ...at(6),
    type: "social",
    title: null,
    profiles: [{ label: "Instagram", href: "https://www.instagram.com/ornek", network: null }],
  },
  {
    ...at(7),
    type: "payments",
    title: "Ödeme",
    payments: [{ key: "bank_transfer", label: "Havale / EFT", logo: null }],
    carriers: [],
  },
  {
    ...at(8),
    type: "image",
    image: IMAGE,
    width: "full",
    link: { label: "Hakkımızda", path: "/hakkimizda" },
  },
  {
    ...at(9),
    type: "trust",
    layout: "list",
    badges: [{ icon: "truck", title: "Ücretsiz kargo", text: "1.500,00 TL ve üzeri" }],
  },
  {
    ...at(10),
    type: "app_badges",
    appStore: "https://apps.apple.com/tr/app/ornek/id000000000",
    googlePlay: null,
  },
]

const row = (over: Partial<FooterRowView> = {}): FooterRowView => ({
  id: "satir00001",
  layout: "2-1-1-1",
  ground: "inherit",
  space: "medium",
  align: "start",
  phoneColumns: 1,
  divider: false,
  columns: [
    { blocks: BLOCKS.slice(0, 1) },
    { blocks: BLOCKS.slice(1, 3) },
    { blocks: BLOCKS.slice(3, 6) },
    { blocks: BLOCKS.slice(6) },
  ],
  ...over,
})

const footerOf = (html: string) => html.slice(html.indexOf("<footer"))

const shopWith = (rows: FooterRowView[], over: Partial<ShopView> = {}, free = FREE) =>
  shopFixture({
    footerBar: { id: "mainfooter", variant: "free_rows", freeRows: free, rows },
    ...over,
  })

const draw = (shop: ShopView) =>
  footerOf(
    renderPage(atolyeTheme, "Layout", {
      shop,
      children: createElement("p", null, "Sayfa"),
      saveCookies: () => Promise.resolve(),
      subscribe: () => Promise.resolve({ ok: true as const }),
    } as never)
  )

describe("the free rows footer", () => {
  it("draws every block type in its column, in the design's order", () => {
    const html = draw(shopWith([row()]))
    expect(html).toContain('data-variant="free_rows"')
    expect(html).toContain('data-layout="2-1-1-1"')
    expect(html.match(/class="gf-fcol"/g)).toHaveLength(4)
    // The brand: its name for want of a logo, its own line
    expect(html).toContain('id="footer-block-0"')
    expect(html).toContain("Kısa tanıtım.")
    // A menu: a nav named by its heading (h2); closed on a phone when asked, open from 1024 px
    expect(html).toContain('<nav aria-labelledby="footer-block-1"')
    expect(html).toMatch(/<h2 id="footer-block-1"[^>]*>Kurumsal<\/h2>/)
    expect(html).toContain('<details class="group border-y border-rule lg:hidden">')
    expect(html).toContain('<nav aria-labelledby="footer-block-1-fold"')
    expect(html.match(/<details/g)).toHaveLength(1)
    // The contact: address, the ways to reach the shop, the hours
    expect(html).toContain("Örnek Mah. 1. Sok. No: 1, Denizli")
    expect(html).toContain('href="tel:+905320000000"')
    expect(html).toContain("Çalışma saatleri")
    // The text: the backend's HTML as it is
    expect(html).toContain('<a href="https://example.com/a" rel="noopener noreferrer">kargo</a>')
    // The newsletter: the joined small form, its own id
    expect(html).toContain('data-news="in_footer"')
    expect(html).toContain('id="bulten-blok-eposta"')
    expect(html).toContain("E-posta almayı kabul ediyorum.")
    // Profiles, ways to pay, the picture (lazy, its sizes from the column), the promises
    expect(html).toContain('href="https://www.instagram.com/ornek"')
    expect(html).toMatch(/<li data-mark="bank_transfer">.*Havale \/ EFT<\/li>/)
    expect(html).toMatch(/<a href="\/hakkimizda" class="block rounded-inner"><picture>/)
    expect(html).toContain('alt="Yerli üretim rozeti"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('sizes="(min-width: 1024px) 20vw, (min-width: 768px) 50vw, 100vw"')
    expect(html).toContain("Ücretsiz kargo")
    // The stores' badges wait for their official files: not drawn
    expect(html).not.toContain("apps.apple.com")
    // Reading order is the DOM's: row, column, block
    expect(html.indexOf("footer-block-0")).toBeLessThan(html.indexOf("footer-block-1"))
    expect(html.indexOf("footer-block-3")).toBeLessThan(html.indexOf("Yerli üretim rozeti"))
    // No inline style (CSP)
    expect(html).not.toContain("style=")
  })

  it("keeps an empty column's place, and its settings as data attributes", () => {
    const html = draw(
      shopWith([
        row({
          layout: "1-1-1",
          ground: "primary",
          space: "small",
          align: "center",
          phoneColumns: 2,
          divider: true,
          columns: [{ blocks: [] }, { blocks: BLOCKS.slice(4, 5) }, { blocks: [] }],
        }),
      ])
    )
    expect(html.match(/<div class="gf-fcol"><\/div>/g)).toHaveLength(2)
    expect(html).toMatch(
      /class="gf-frow" data-ground="primary" data-space="small" data-align="center" data-divider=""/
    )
    expect(html).toContain('data-phone-columns="2"')
  })

  it("marks a block for the screens that show it", () => {
    const html = draw(
      shopWith([
        row({
          layout: "1",
          columns: [{ blocks: [{ ...BLOCKS[4], device: "mobile" } as FooterBlockView] }],
        }),
      ])
    )
    expect(html).toContain('class="gf-fblock" data-block="text" data-device="mobile"')
  })

  it("joins closed menus one after another into one list on a phone", () => {
    const menu = (n: number, over: Partial<FooterBlockView> = {}) =>
      ({
        ...at(n),
        type: "menu",
        title: `Menü ${String(n)}`,
        links: [{ label: "SSS", path: "/sss" }],
        collapsePhone: true,
        ...over,
      }) as FooterBlockView
    const html = draw(
      shopWith([
        row({
          layout: "1-1-1-1",
          columns: [
            // The first stands alone; the next in its column and the next column's join it
            { blocks: [menu(0), menu(1)] },
            { blocks: [menu(2)] },
            // A computer's block keeps its column's box on a phone: no join across it
            {
              blocks: [
                { ...BLOCKS[4], at: 3, id: "blokmasaust", device: "desktop" } as FooterBlockView,
              ],
            },
            // An open menu is no fold; nor is what follows a block between
            {
              blocks: [
                menu(4),
                menu(5, { collapsePhone: false }),
                { ...BLOCKS[4], at: 6, id: "bloksizmetin" } as FooterBlockView,
                menu(7),
              ],
            },
          ],
        }),
      ])
    )
    const joins = [...html.matchAll(/data-block="menu"( data-fold-join="(\w+)")?/g)].map(
      (match) => match[2] ?? "-"
    )
    expect(joins).toEqual(["-", "block", "column", "-", "-", "-"])
    const css = atolyeCss("footer-rows.css")
    expect(css).toContain('.gf-fblock[data-fold-join="block"]')
    expect(css).toContain('.gf-fblock[data-fold-join="column"]')
    // A lone closed menu stands on its own
    const lone = draw(shopWith([row({ layout: "1", columns: [{ blocks: [menu(0)] }] })]))
    expect(lone).not.toContain("data-fold-join")
  })

  it("puts field marks on its rows and blocks only in the editor's live preview", () => {
    const live = draw(shopWith([row()]))
    expect(live).not.toContain("data-qf=")
    const editing = draw(shopWith([row()], { editor: true }))
    expect(editing).toContain('data-qf="rows.0"')
    expect(editing).toContain('data-qf="blocks.0"')
    expect(editing).toContain('data-qf="blocks.0.about"')
    expect(editing).toContain('data-qf="blocks.1.title"')
    expect(editing).toContain('data-qf="blocks.4.body"')
    expect(editing).toContain('data-qf="blocks.5.text"')
    expect(editing).toContain('data-qf="blocks.8.image"')
  })

  it("always draws the legal strip and the bottom line, rows or none", () => {
    for (const rows of [[row()], []]) {
      const html = draw(shopWith(rows))
      expect(html).toContain('data-footer-legal=""')
      expect(html).toContain('<nav aria-label="Yasal metinler"')
      expect(html).toContain('href="/yasal/mesafeli-satis-sozlesmesi"')
      expect(html).toContain("MERSİS: 0000000000000000")
      expect(html).toContain(`© ${new Date().getFullYear()} Örnek Atölye Ltd. Şti.`)
      expect(html).toContain('href="/cerez-tercihleri"')
      expect(html.indexOf('data-footer-legal=""')).toBeLessThan(html.indexOf("©"))
    }
  })

  it("draws no empty legal strip for a shop with neither a legal text nor an identity line", () => {
    const bare = draw(
      shopWith([], { legalLinks: [], identityLines: [], companyTitle: null, etbisQr: null })
    )
    expect(bare).not.toContain('data-footer-legal=""')
    expect(bare).toContain('href="/cerez-tercihleri"')
  })

  it("leaves the ways to pay out of the bottom line when the shop turns them off", () => {
    const marks = { paymentMarks: [{ key: "bank_transfer", label: "Havale / EFT", logo: null }] }
    expect(draw(shopWith([], marks))).toContain('<ul aria-label="Ödeme seçenekleri"')
    const off = draw(shopWith([], marks, { ...FREE, bottomBadges: false }))
    expect(off).not.toContain('<ul aria-label="Ödeme seçenekleri"')
    expect(off).toContain('href="/cerez-tercihleri"')
  })

  it("turns only the parts on the stage dark, a light row keeping the page's inks", () => {
    const html = draw(
      shopWith(
        [row({ id: "satiracik1", ground: "page" }), row({ id: "satirkoyu1" })],
        {},
        { ...FREE, ground: "stage", badgeStyle: "plain" }
      )
    )
    expect(html).toMatch(/<footer[^>]*data-ground="stage" data-badges="plain"/)
    expect(html).toContain('class="gf-frow" data-ground="page"')
    expect(html).toContain('class="gf-frow gf-stage" data-ground="inherit"')
    expect(html).toContain('class="gf-foot-fixed gf-stage"')
  })

  it("draws the ledger while the free rows' settings are missing", () => {
    const html = footerOf(
      renderFrame(
        atolyeTheme,
        shopFixture({ footerBar: { id: "mainfooter", variant: "free_rows" } })
      )
    )
    expect(html).toContain('data-variant="ledger"')
  })

  it("keeps its grid, grounds and screens in the theme's stylesheet", () => {
    const css = atolyeCss("footer-rows.css")
    expect(css).toContain('.gf-frow-grid[data-layout="2-1-1-1"]')
    expect(css).toContain('.gf-frow-grid[data-phone-columns="2"]')
    expect(css).toContain('.gf-frow[data-ground="primary"]')
    expect(css).toContain('.gf-fblock[data-device="mobile"]')
    expect(css).not.toMatch(/^\s*order\s*:/m)
  })
})
