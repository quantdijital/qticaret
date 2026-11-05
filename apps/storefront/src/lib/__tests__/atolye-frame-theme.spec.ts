import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { PlaceOrderResult } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The theme's frame (docs/tema/yon-2026-11-05.md § Frame) as the server
 * prints it: one announcement, the two-row header with its search, the
 * aisle's panels in the HTML, the graphite footer with the shop's contact,
 * marks and small print. Only what the shop gave is drawn.
 */

const subscribe = (): Promise<PlaceOrderResult> =>
  Promise.resolve({ ok: true, error: null, challenge: null })

describe("the theme's frame", () => {
  it("says one announcement, and none on a phone without a line", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ announcements: ["Birinci", "İkinci"] }))
    expect(html).toContain("Birinci")
    expect(html).not.toContain("İkinci")
    const bare = renderFrame(atolyeTheme, shopFixture({ announcements: [] }))
    expect(bare).toContain("max-lg:hidden")
    expect(bare).toContain("Hakkımızda")
  })

  it("draws nothing above the header without lines, links or phone", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        announcements: [],
        topLinks: [],
        contact: { ...shopFixture().contact, phone: null, phoneHref: null },
      })
    )
    expect(html).not.toContain('aria-label="Kurumsal bağlantılar"')
  })

  it("has two script-free searches, favourites and the cart with its count", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html.match(/action="\/arama"/g)).toHaveLength(2)
    expect(html).toContain('href="/hesap/favoriler"')
    expect(html).toContain('aria-label="Sepet, 2 ürün"')
    expect(html).toContain('href="/sepet"')
  })

  it("keeps every category panel's links in the HTML and the wordmark without a logo", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html).toContain('href="/kategori/cakilar/katlanir"')
    expect(html).toContain("Tümünü gör: Çakılar")
    expect(html).toContain("Örnek Atölye</span>")
  })

  it("closes on the shop's contact, menus, marks and small print, each identity line its own", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        paymentMarks: [{ key: "visa", label: "Visa" }],
        carrierMarks: [{ key: "aras", label: "Aras Kargo" }],
        etbisQr: {
          src: "/media/etbis.png",
          alt: "ETBİS",
          width: 300,
          height: 300,
          sources: { avif: null, webp: null },
        },
      })
    )
    expect(html).toContain("Örnek Atölye Ltd. Şti.")
    expect(html).toContain("Örnek Mah. 1. Sok. No: 1, Denizli")
    expect(html).toContain('href="tel:+905320000000"')
    expect(html).toContain('href="mailto:bilgi@example.com"')
    expect(html).toContain('href="https://www.instagram.com/ornek"')
    expect(html).toContain("Ödeme seçenekleri")
    expect(html).toContain("Aras Kargo")
    expect(html).toContain("ETBİS kayıt karekodu")
    expect(html).toContain("<li>MERSİS: 0000000000000000</li>")
    expect(html).toContain('href="/cerez-tercihleri"')
    expect(html).not.toContain("·")
  })

  it("leaves the marks out when the shop has none", () => {
    expect(renderFrame(atolyeTheme, shopFixture())).not.toContain("Ödeme seçenekleri")
  })

  it("opens the footer with the newsletter, its consent box unticked and required", () => {
    const shop = shopFixture({ newsletter: { title: "E-bülten", text: "Onay metni." } })
    const html = renderPage(atolyeTheme, "Layout", {
      shop,
      children: null,
      saveCookies: () => Promise.resolve(),
      subscribe,
    })
    expect(html).toContain(">E-bülten</h2>")
    expect(html).toMatch(/<input type="checkbox" required=""[^>]*name="consent" value="1"/)
    expect(html).not.toMatch(/<input type="checkbox"[^>]*checked=""[^>]*name="consent"/)
    expect(html).toContain("Onay metni.")
    expect(renderFrame(atolyeTheme, shop)).not.toContain('name="consent"')
  })

  it("marks the page's own item in the bottom bar and asks the cookie question as a plain form", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        cookieBanner: {
          policyVersion: 3,
          policyPath: null,
          due: true,
          analytics: false,
          marketing: false,
        },
      })
    )
    expect(html).toMatch(/<a href="\/" aria-current="page"/)
    expect(html).toMatch(/<button type="submit" value="necessary"[^>]*name="choice"/)
    expect(html).toMatch(/<button type="submit" value="all"[^>]*name="choice"/)
    expect(html).toContain('name="policy_version" value="3"')
  })
})
