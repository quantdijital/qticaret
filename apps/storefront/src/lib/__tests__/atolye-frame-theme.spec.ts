import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { PlaceOrderResult } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The theme's frame (docs/tema/yon-2026-11-05.md § Frame) as the server
 * prints it: one announcement, the two-row header with its search, the
 * aisle's panels in the HTML, the compact footer with the shop's contact,
 * menus, the providers' own marks and the small print. Only what the shop
 * gave is drawn.
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

  it("gives a category's panel its name, its see-all link, its children and its picture tile", () => {
    const categories = shopFixture().categories.map((category, index) =>
      index === 0
        ? {
            ...category,
            image: {
              src: "/media/cakilar.jpg",
              alt: "",
              width: 800,
              height: 600,
              sources: { avif: null, webp: null },
            },
          }
        : category
    )
    const html = renderFrame(atolyeTheme, shopFixture({ categories }))
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Çakılar/)
    expect(html).toContain('href="/kategori/cakilar/sabit"')
    // The picture is the same page as "Tümünü gör": one stop for the keyboard
    expect(html).toMatch(/<a href="\/kategori\/cakilar" tabindex="-1" aria-hidden="true"/)
    expect(html).toContain('src="/media/cakilar.jpg"')
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
        paymentMarks: [
          { key: "visa", label: "Visa", logo: { src: "/marks/visa.png", width: 208, height: 68 } },
          { key: "bank_transfer", label: "Havale / EFT", logo: null },
        ],
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
    expect(html).toContain(">Ödeme</dt>")
    expect(html).toContain(">Kargo</dt>")
    // The provider's own mark, named by its alt text; a way to pay without one by its name
    expect(html).toMatch(/<img src="\/marks\/visa.png" alt="Visa" width="208" height="68"/)
    expect(html).toContain("Havale / EFT")
    expect(html).toContain("Aras Kargo")
    expect(html).not.toMatch(/<a[^>]*>[^<]*<img src="\/marks/)
    expect(html).toContain('alt="ETBİS kayıt karekodu"')
    expect(html).toContain("<li>MERSİS: 0000000000000000</li>")
    expect(html).toMatch(/<p class="[^"]*">© \d{4} Örnek Atölye Ltd. Şti.<\/p>/)
    expect(html).toContain('href="/cerez-tercihleri"')
    expect(html).not.toContain("·")
  })

  it("closes each menu group on a phone, stands them open from 1024 px, the legal texts in the small print", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html.match(/<details class="group border-b border-rule">/g)).toHaveLength(1)
    expect(html.match(/>Yardım</g)).toHaveLength(2)
    expect(html).toMatch(/<nav aria-label="Yasal metinler">/)
    expect(html.match(/href="\/yasal\/mesafeli-satis-sozlesmesi"/g)).toHaveLength(1)
    expect(html).not.toContain("text-mast")
  })

  it("leaves the marks out when the shop has none", () => {
    expect(renderFrame(atolyeTheme, shopFixture())).not.toContain(">Ödeme</dt>")
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
    // The footer's box shows its consent once the visitor starts on it; the box stays required
    expect(html).toMatch(/<form class="[^"]*gf-news[^"]*"/)
    expect(html).toMatch(/<div class="gf-news-more[^"]*"><label/)
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
