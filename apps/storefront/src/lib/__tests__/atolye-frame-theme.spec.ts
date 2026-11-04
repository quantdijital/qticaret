import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * The Atölye theme's frame (design.md § Components) as the server prints
 * it: what is drawn, what is left out, and where the WhatsApp button
 * stays away.
 */

describe("the Atölye frame's announcement band", () => {
  it("is not drawn at all without lines, links or a phone", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        topLinks: [],
        contact: { ...shopFixture().contact, phone: null, phoneHref: null },
      })
    )

    expect(html).not.toContain("at-signal-band")
  })

  it("is left out on a phone when it has no line (denetim §0.4), kept wide for its links", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html).toMatch(/class="at-signal-band [^"]*max-lg:hidden/)
    expect(html).toContain('href="/hakkimizda"')
  })

  it("lists each line as its own item, with no dots between them", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({ announcements: ["Aynı gün kargo", "İade 14 gün"] })
    )

    expect(html).not.toMatch(/class="at-signal-band [^"]*max-lg:hidden/)
    expect(html.match(/<li[^>]*>(Aynı gün kargo|İade 14 gün)<\/li>/g)).toHaveLength(2)
    expect(html).not.toContain("·")
  })
})

describe("the Atölye header", () => {
  it("names the shop in its display face without a logo file, and links home", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html).toMatch(
      /<a href="\/"[^>]*><span class="[^"]*font-display[^"]*">Örnek Atölye<\/span>/
    )
  })

  it("has two plain search forms (phone and wide) to /arama", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html.match(/<form role="search"[^>]*action="\/arama" method="get">/g)).toHaveLength(2)
    expect(html).toContain('id="arama-dar"')
    expect(html).toContain('id="arama-genis"')
  })

  it("keeps every category link in the HTML, the menu's panels closed", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html).toContain('href="/kategori/cakilar/katlanir"')
    expect(html).toContain('href="/kategori/cakilar/sabit"')
    expect(html).toContain("Tümünü gör: Çakılar")
    expect(html).toContain('href="/kategori/aksesuar"')
  })

  it("shows the cart's count in a live square, and names the link with it", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ cartQuantity: 3 }))

    expect(html).toContain('aria-label="Sepet, 3 ürün"')
    expect(html).toMatch(/<span aria-live="polite"[^>]*>3<\/span>/)
  })
})

describe("the Atölye footer", () => {
  it("puts each identity line on a line of its own, never joined by dots", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html).toContain("<li>MERSİS: 0000000000000000</li>")
    expect(html).toContain("<li>Denizli V.D. 0000000000</li>")
    expect(html).not.toContain("0000000000000000 · ")
  })

  it("closes with the year and the registered name, no unverified security claim", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html).toContain(`© ${String(new Date().getFullYear())} Örnek Atölye Ltd. Şti.`)
    expect(html).not.toContain("SSL")
    expect(html).not.toContain("Tüm hakları saklıdır")
  })

  it("keeps the cookie preferences link and the shop's legal pages", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html).toContain('href="/cerez-tercihleri"')
    expect(html).toContain('href="/yasal/mesafeli-satis-sozlesmesi"')
  })
})

describe("the Atölye WhatsApp button", () => {
  const button = 'data-whatsapp=""'

  it("is on an ordinary page when the shop gave a number", () => {
    expect(renderFrame(atolyeTheme, shopFixture())).toContain(button)
  })

  it("stays away from the cart and the checkout, where it covered totals and fields", () => {
    expect(renderFrame(atolyeTheme, shopFixture({ bottomNav: { current: "cart" } }))).not.toContain(
      button
    )
    expect(renderFrame(atolyeTheme, shopFixture({ bottomNav: null }))).not.toContain(button)
  })

  it("waits while the cookie question is due, and is not drawn without a number", () => {
    const due = {
      policyVersion: 1,
      policyPath: null,
      due: true,
      analytics: false,
      marketing: false,
    }
    expect(renderFrame(atolyeTheme, shopFixture({ cookieBanner: due }))).not.toContain(button)
    expect(
      renderFrame(
        atolyeTheme,
        shopFixture({ contact: { ...shopFixture().contact, whatsappHref: null } })
      )
    ).not.toContain(button)
  })
})

describe("the Atölye cookie banner", () => {
  it("offers the two answers in the same style, the form working without script", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        cookieBanner: {
          policyVersion: 3,
          policyPath: "/yasal/cerez-politikasi",
          due: true,
          analytics: false,
          marketing: false,
        },
      })
    )

    const necessary = /<button type="submit" value="necessary" class="([^"]+)" name="choice">/.exec(
      html
    )
    const all = /<button type="submit" value="all" class="([^"]+)" name="choice">/.exec(html)
    expect(necessary?.[1]).toBeDefined()
    expect(necessary?.[1]).toBe(all?.[1])
    expect(html).toContain('name="policy_version" value="3"')
  })
})
