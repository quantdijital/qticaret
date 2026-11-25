import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { FooterBarView, FooterColumnsView, ShopView } from "@qticaret/ui"
import { atolyeCss } from "@/test/atolye-css"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The brand columns footer (adr/0049 Ek 2026-11-17): a strip with the
 * newsletter and the ways to reach the shop, the brand block beside the
 * link columns, one bottom line with the year, the ways to pay by their
 * own marks and the cookie choices; the ledger stays as it was.
 */

const COLUMNS: FooterColumnsView = {
  topStrip: true,
  about: "Hafta içi 16.00'ya kadar verilen sipariş aynı gün kargoda.",
  ground: "well",
  badgeStyle: "card",
}

const bar = (over: Partial<FooterBarView> = {}, columns: Partial<FooterColumnsView> = {}) => ({
  id: "mainfooter",
  variant: "brand_columns" as const,
  columns: { ...COLUMNS, ...columns },
  ...over,
})

const footerOf = (html: string) => html.slice(html.indexOf("<footer"))

const withNewsletter = (shop: ShopView) =>
  footerOf(
    renderPage(atolyeTheme, "Layout", {
      shop,
      children: createElement("p", null, "Sayfa"),
      saveCookies: () => Promise.resolve(),
      subscribe: () => Promise.resolve({ ok: true as const }),
    } as never)
  )

const MARKS = [
  { key: "visa", label: "Visa", logo: { src: "/marks/visa.png", width: 208, height: 68 } },
  {
    key: "amex",
    label: "American Express",
    logo: { src: "/marks/amex.svg", width: 24, height: 24 },
  },
  { key: "bank_transfer", label: "Havale / EFT", logo: null },
]

describe("the brand columns footer", () => {
  it("draws the strip, the brand block, the columns and one bottom line", () => {
    const html = withNewsletter(
      shopFixture({
        newsletter: { title: "Yeni ürünlerden ilk siz haberdar olun", text: "" },
        footerBar: bar({ paymentBadges: MARKS }),
      })
    )

    expect(html).toContain('data-variant="brand_columns"')
    expect(html).toContain('data-ground="well"')
    expect(html).toContain('data-badges="card"')
    // The strip: the newsletter beside the phone, WhatsApp and e-mail
    expect(html).toContain('id="bulten"')
    expect(html).toContain('aria-label="Bize ulaşın"')
    expect(html).toContain('href="tel:+905320000000"')
    expect(html).toContain(
      'href="https://wa.me/905320000000" target="_blank" rel="noopener noreferrer"'
    )
    expect(html).toContain('href="mailto:bilgi@example.com"')
    // ...said once: the brand block keeps the address only
    expect(html.match(/href="tel:/g)).toHaveLength(1)
    expect(html).toContain("Örnek Mah. 1. Sok. No: 1, Denizli")
    expect(html).toContain("Hafta içi 16.00&#x27;ya kadar verilen sipariş aynı gün kargoda.")
    // The law's identity lines with the registered title
    expect(html).toContain("MERSİS: 0000000000000000")
    // The footer menus and the legal texts as columns; closed rows on a phone
    expect(html).toContain('<nav aria-label="Yardım"')
    expect(html).toContain('<nav aria-label="Yasal metinler"')
    expect(html).toContain('href="/yasal/mesafeli-satis-sozlesmesi"')
    expect(html).toMatch(/<details class="group border-b border-rule">/)
    // The bottom line: the year, the marks as their own files with their names
    expect(html).toContain(`© ${new Date().getFullYear()} Örnek Atölye Ltd. Şti.`)
    expect(html).toContain('<ul aria-label="Ödeme seçenekleri" class="gf-pay">')
    expect(html).toMatch(
      /<li data-mark="visa" data-logo=""><img src="\/marks\/visa.png" alt="Visa"/
    )
    expect(html).toContain('alt="American Express"')
    expect(html).toMatch(/<li data-mark="bank_transfer">.*Havale \/ EFT<\/li>/)
    // The cookie choices close the legal column, not beside the ways to pay (owner 2026-11-26)
    const legal = html.slice(html.lastIndexOf('<nav aria-label="Yasal metinler"'))
    expect(legal.slice(0, legal.indexOf("</nav>"))).toContain('href="/cerez-tercihleri"')
    expect(html.slice(html.indexOf("gf-foot-line"))).not.toContain('href="/cerez-tercihleri"')
    expect(html).toContain("Yukarı çık")
    // No inline style (CSP)
    expect(footerOf(html)).not.toContain("style=")
  })

  it("moves the phone and e-mail into the brand block without the strip, the newsletter under them", () => {
    const html = withNewsletter(
      shopFixture({
        newsletter: { title: "Bülten", text: "" },
        footerBar: bar({}, { topStrip: false, about: null }),
      })
    )
    expect(html).not.toContain('aria-label="Bize ulaşın"')
    expect(html.match(/href="tel:/g)).toHaveLength(1)
    expect(html).toContain('href="mailto:bilgi@example.com"')
    expect(html).toContain('id="bulten"')
    expect(html.indexOf('id="footer-brand"')).toBeLessThan(html.indexOf('id="bulten"'))
  })

  it("sets the newsletter as the row's last column, the brand block bare, the line centred", () => {
    const html = withNewsletter(
      shopFixture({
        newsletter: {
          title: "E-bülten",
          text: "",
          description: "Fırsatlardan ilk siz haberdar olun.",
        },
        footerBar: bar(
          {},
          {
            topStrip: false,
            about: null,
            newsPlace: "column",
            brandContact: "hide",
            bottomAlign: "center",
          }
        ),
      })
    )
    expect(html).not.toContain('href="tel:')
    expect(html).not.toContain('href="mailto:')
    expect(html).toContain("lg:col-span-3")
    expect(html).toContain("lg:col-span-6")
    expect(html).toMatch(/lg:border-l lg:border-rule[^"]*"><section aria-labelledby="bulten"/)
    expect(html).toContain("Fırsatlardan ilk siz haberdar olun.")
    expect(html.indexOf('id="footer-brand"')).toBeLessThan(html.indexOf('id="bulten"'))
    expect(html).toContain('data-align="center"')
  })

  it("keeps the newsletter under the brand block, its contact and the spread line by default", () => {
    const html = withNewsletter(
      shopFixture({
        newsletter: { title: "Bülten", text: "" },
        footerBar: bar({}, { topStrip: false, about: null }),
      })
    )
    expect(html).not.toContain('data-align="center"')
    expect(html).not.toContain("lg:col-span-3")
    expect(html).toContain('href="mailto:bilgi@example.com"')
  })

  it("shows the providers' marks while the shop names none, the carriers beside them", () => {
    const html = footerOf(
      renderFrame(
        atolyeTheme,
        shopFixture({
          paymentMarks: MARKS.slice(0, 1),
          carrierMarks: [
            {
              key: "aras",
              label: "Aras Kargo",
              logo: { src: "/marks/aras.svg", width: 148, height: 40 },
            },
          ],
          footerBar: bar(),
        })
      )
    )
    expect(html).toContain('alt="Visa"')
    expect(html).toContain('<ul aria-label="Kargo firmaları" class="gf-pay">')
    expect(html).toContain('alt="Aras Kargo"')
  })

  it("stands on the graphite stage on request, its buttons and fields the stage's", () => {
    const html = footerOf(
      renderFrame(
        atolyeTheme,
        shopFixture({ footerBar: bar({}, { ground: "stage", badgeStyle: "plain" }) })
      )
    )
    expect(html).toMatch(/<footer[^>]*data-ground="stage"[^>]*class="gf-footer-cols [^"]*gf-stage/)
    expect(html).toContain('data-badges="plain"')
  })

  it("leaves the line's up link to the floating button where it shows", () => {
    const html = footerOf(
      renderFrame(
        atolyeTheme,
        shopFixture({
          footerBar: bar({ backToTop: { side: "right", shape: "round", mobile: true } }),
        })
      )
    )
    expect(html).not.toContain('href="#top"')
  })

  it("draws today's ledger for the ledger, and for a footer without its settings", () => {
    const ledger = footerOf(renderFrame(atolyeTheme, shopFixture()))
    expect(ledger).toContain('data-variant="ledger"')
    expect(ledger).not.toContain("gf-footer-cols")
    const bare = footerOf(
      renderFrame(
        atolyeTheme,
        shopFixture({ footerBar: { id: "mainfooter", variant: "brand_columns" } })
      )
    )
    expect(bare).toContain('data-variant="ledger"')
  })

  it("keeps its marks' cards and grounds in the theme's stylesheet", () => {
    const css = atolyeCss("footer-columns.css")
    expect(css).toContain('.gf-footer-cols[data-ground="stage"]')
    expect(css).toContain(".gf-pay")
    expect(css).toContain('.gf-pay [data-mark="amex"] img')
    expect(css).toContain('.gf-foot-line[data-align="center"]')
  })

  it("keeps up to four link columns in one row, five and more as many as fit", () => {
    const css = atolyeCss("footer-columns.css")
    // More than four still wrap at 10rem each
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));")
    // Four at 10rem each did not fit the eight columns they are given from 1024 to
    // 1175 px: the fourth fell alone under the other three
    const fewer = /\.gf-foot-columns:not\(:has\(> :nth-child\(5\)\)\) \{([^}]*)\}/.exec(css)
    expect(fewer?.[1]).toContain("grid-auto-flow: column;")
    expect(fewer?.[1]).toContain("grid-auto-columns: minmax(0, 1fr);")
  })
})
