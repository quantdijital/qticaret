import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { createElement } from "react"
import type { PlaceOrderResult, ShopView } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The theme's frame (docs/tema/yon-2026-11-05.md § Frame) as the server
 * prints it: one announcement, the two-row header with its search, the
 * aisle's dropdowns in the HTML, the compact footer with the shop's contact,
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

  it("opens a category's dropdown from its button: no big picture tile any more", () => {
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
    expect(html).toMatch(
      /<button[^>]*aria-expanded="false"[^>]*><span class="gf-menu-word"[^>]*>Çakılar/
    )
    expect(html).toContain('href="/kategori/cakilar/sabit"')
    // The top category's own picture stays in the phone's sheet, not in the dropdown
    expect(html).not.toMatch(/<a href="\/kategori\/cakilar" tabindex="-1" aria-hidden="true"/)
    expect(html).not.toContain('src="/media/cakilar.jpg"')
  })

  it("keeps every category panel's links in the HTML and the wordmark without a logo", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html).toContain('href="/kategori/cakilar/katlanir"')
    // The dropdown's last row reads "Tümünü gör"; a screen reader hears it whole (K-21)
    expect(html).toMatch(
      /<a href="\/kategori\/cakilar" class="gf-drop-row gf-drop-all"[^>]*><span class="gf-menu-word" aria-hidden="true">Tümünü gör<\/span><span class="sr-only">Tümünü gör: Çakılar<\/span>/
    )
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
    // One band of marks, the two groups named for a screen reader
    expect(html).toContain('<ul aria-label="Ödeme seçenekleri"')
    expect(html).toContain('<ul aria-label="Kargo firmaları"')
    // The provider's own mark, named by its alt text; a way to pay without one by its name
    expect(html).toMatch(/<img src="\/marks\/visa.png" alt="Visa" width="208" height="68"/)
    expect(html).toContain("Havale / EFT")
    expect(html).toContain("Aras Kargo")
    expect(html).not.toMatch(/<a[^>]*>[^<]*<img src="\/marks/)
    expect(html).toContain('alt="ETBİS kayıt karekodu"')
    expect(html).toContain("<li>MERSİS: 0000000000000000</li>")
    // One muted line: the year and title, then the identity lines; the dots between them are drawn
    expect(html).toMatch(
      /<li>© \d{4} Örnek Atölye Ltd. Şti.<\/li><li>MERSİS: 0000000000000000<\/li>/
    )
    expect(html).toContain('href="/cerez-tercihleri"')
    expect(html).not.toContain("·")
    expect(html).toContain('href="#top"')
    // The floating WhatsApp keeps off the footer's controls
    expect(html).toMatch(/<footer data-gf-clear=""/)
  })

  it("closes each menu group on a phone, stands them open from 1024 px, the legal texts in the small print", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html.match(/<details class="group border-b border-rule">/g)).toHaveLength(1)
    expect(html.match(/>Yardım</g)).toHaveLength(2)
    // The legal texts: a closed row on a phone, four short columns from 1024 px; one shown
    expect(html.match(/<nav aria-label="Yasal metinler"/g)).toHaveLength(2)
    expect(html.match(/href="\/yasal\/mesafeli-satis-sozlesmesi"/g)).toHaveLength(2)
    expect(html).not.toContain("text-mast")
  })

  it("shows the KVKK notice by its short name, its full title kept on the link", () => {
    const title = "Kişisel Verilerin Korunması Aydınlatma Metni"
    const html = renderFrame(
      atolyeTheme,
      shopFixture({ legalLinks: [{ label: title, path: "/yasal/kvkk-aydinlatma-metni" }] })
    )
    expect(html).toContain(`title="${title}"`)
    expect(html).toMatch(/>KVKK Aydınlatma Metni<\/a>/)
    expect(html).not.toContain(`>${title}</a>`)
  })

  it("leaves the marks out when the shop has none", () => {
    expect(renderFrame(atolyeTheme, shopFixture())).not.toContain('aria-label="Ödeme seçenekleri"')
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

  it("marks the sticky header's folding parts, never a header the shop keeps in place", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html).toMatch(/<header data-gf-head="" class="[^"]*gf-head sticky top-0/)
    expect(html).toMatch(/class="[^"]*gf-head-row[^"]*" data-gf-head-row=""/)
    expect(html).toContain('data-gf-aisle=""')
    const still = shopFixture()
    still.theme = { ...still.theme, header: { ...still.theme.header, sticky: false } }
    expect(renderFrame(atolyeTheme, still)).not.toContain("gf-head sticky")
    // The design's header bar (adr/0049 Ek 2026-11-14 §5) over the theme's setting
    const bar = shopFixture({ headerBar: { id: "mainheader", variant: "centered", sticky: false } })
    const kept = renderFrame(atolyeTheme, bar)
    expect(kept).not.toContain("gf-head sticky")
    expect(kept).toContain('data-variant="centered"')
  })

  it("keeps the bottom bar's search a link to /arama before the script, and the field's example whole", () => {
    const html = renderFrame(atolyeTheme, shopFixture())
    expect(html).toMatch(/<a href="\/arama"[^>]*>(?:(?!<\/a>).)*Ara<\/a>/)
    expect(html).toMatch(/id="arama-dar"[^>]*class="gf-field pr-14"/)
  })
})

describe("the checkout's frame", () => {
  const checkout = (over: Partial<ShopView> = {}) =>
    renderPage(atolyeTheme, "Layout", {
      shop: shopFixture({
        checkout: true,
        bottomNav: null,
        announcements: ["1.500 TL üzeri kargo bedava"],
        newsletter: { title: "E-bülten", text: "Onay metni." },
        ...over,
      }),
      children: createElement("p", null, "Sayfa"),
      saveCookies: () => Promise.resolve(),
      subscribe,
    })

  it("heads the page with the wordmark, the lock, the shop's WhatsApp and the way back to the cart", () => {
    const html = checkout()
    expect(html).toMatch(/<header data-gf-checkout=""/)
    expect(html).toMatch(/<a href="\/"[^>]*>(?:(?!<\/a>).)*Örnek Atölye/)
    expect(html).toContain("Güvenli ödeme")
    expect(html).toMatch(
      /<a href="https:\/\/wa.me\/905320000000" target="_blank" rel="noopener"[^>]*>(?:(?!<\/a>).)*WhatsApp&#x27;tan yazın<\/span><\/a>/
    )
    expect(html).toMatch(/<a href="\/sepet"[^>]*>(?:(?!<\/a>).)*Sepete dön<\/span><\/a>/)
  })

  it("leaves out the search, the aisle, the announcement, the bottom bar and the floating WhatsApp", () => {
    const html = checkout()
    expect(html).not.toContain('type="search"')
    expect(html).not.toContain("data-gf-aisle")
    expect(html).not.toContain("data-gf-head")
    expect(html).not.toContain("1.500 TL üzeri kargo bedava")
    expect(html).not.toContain("Hızlı gezinme")
    expect(html).not.toContain("data-whatsapp")
    // The cart is a page away, not a drawer
    expect(html).not.toContain("data-drawer")
  })

  it("closes on the small print only: the legal texts, the cookie choices, the identity lines and the year", () => {
    const html = checkout()
    expect(html).toMatch(/<nav aria-label="Yasal metinler"/)
    expect(html).toContain('href="/yasal/mesafeli-satis-sozlesmesi"')
    expect(html).toContain('href="/cerez-tercihleri"')
    expect(html).toContain("<li>MERSİS: 0000000000000000</li>")
    expect(html).toMatch(/<li>© \d{4} Örnek Atölye Ltd. Şti.<\/li>/)
    expect(html).not.toContain("E-bülten")
    expect(html).not.toContain('href="/iletisim"')
    expect(html).not.toContain("bilgi@example.com")
  })

  it("offers the phone without a WhatsApp number, and no help link without either", () => {
    const contact = shopFixture().contact
    const phone = checkout({ contact: { ...contact, whatsappHref: null } })
    expect(phone).toMatch(/<a href="tel:\+905320000000"[^>]*>(?:(?!<\/a>).)*Bizi arayın:/)
    expect(phone).not.toContain("wa.me")
    const none = checkout({ contact: { ...contact, whatsappHref: null, phoneHref: null } })
    expect(none).not.toContain("tel:")
    expect(none).toContain("Sepete dön")
  })

  it("is the shop's frame wherever the storefront does not say checkout", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ checkout: false }))
    expect(html).toContain("data-gf-head")
    expect(html).not.toContain("data-gf-checkout")
  })
})
