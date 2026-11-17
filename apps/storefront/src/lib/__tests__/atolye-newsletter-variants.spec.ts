import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ImageView, PlaceOrderResult, ShopView } from "@qticaret/ui"
import { renderPage, shopFixture } from "@/test/theme-render"

/**
 * The newsletter box's variants (adr/0049 Ek 2026-11-17 e-bülten): today's
 * box drawn as it was; `split`, `image_card`, `strip` and the footer's
 * `in_footer` with the field and the button one piece, the label for
 * screen readers, the consent box as before (unticked, required) and the
 * privacy notice's link always under the form.
 */

const subscribe = (): Promise<PlaceOrderResult> =>
  Promise.resolve({ ok: true, error: null, challenge: null })

const PICTURE: ImageView = {
  src: "/media/bulten.jpg",
  alt: "",
  width: 1200,
  height: 900,
  sources: { avif: null, webp: null },
}

const LOOK = {
  description: "Yeni modeller ve bakım notları ayda birkaç kez e-postanızda.",
  note: "Ayda birkaç e-posta · İstediğiniz an ayrılın",
  image: null,
}

const box = (over: Partial<Extract<HomeSectionView, { type: "newsletter" }>>) =>
  ({
    id: "bulten",
    type: "newsletter",
    title: "Haberdar olun",
    text: "Onay metni.",
    privacyPath: "/yasal/kvkk",
    ...over,
  }) as HomeSectionView

const home = (section: HomeSectionView) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: [section] }, subscribe })

const footerOf = (shop: ShopView) => {
  const html = renderPage(atolyeTheme, "Layout", {
    shop,
    children: createElement("p", null, "Sayfa"),
    saveCookies: () => Promise.resolve(),
    subscribe,
  })
  return html.slice(html.indexOf("<footer"))
}

const CONSENT = /<input type="checkbox" required=""[^>]*name="consent" value="1"/

describe("the newsletter box's variants on a page", () => {
  it("draws today's box as it was: a visible label, the link inside the consent", () => {
    const html = home(box({ variant: "standard", ...LOOK }))

    expect(html).not.toContain("data-news=")
    expect(html).not.toContain("gf-join")
    expect(html).not.toContain(LOOK.description)
    expect(html).toMatch(/<label for="[^"]+-eposta" class="text-sm font-semibold">/)
    expect(html).toMatch(CONSENT)
  })

  it("draws the split band: words left, one joined form, the link under it", () => {
    const html = home(box({ variant: "split", ...LOOK }))

    expect(html).toContain('data-news="split"')
    expect(html).toContain(`>${LOOK.description}</p>`)
    expect(html).toContain(">Ayda birkaç e-posta · İstediğiniz an ayrılın</p>")
    expect(html).toMatch(/<label for="[^"]+-eposta" class="sr-only">E-posta adresiniz<\/label>/)
    expect(html).toContain('class="gf-join"')
    expect(html).toMatch(CONSENT)
    expect(html).toMatch(/class="gf-news-privacy text-xs"><a href="\/yasal\/kvkk"/)
    // The status line says any error aloud
    expect(html).toMatch(/role="alert"/)
  })

  it("draws the picture beside the words, and falls back to the split band without one", () => {
    const pictured = home(box({ variant: "image_card", ...LOOK, image: PICTURE }))
    expect(pictured).toContain('data-news="image_card"')
    expect(pictured).toContain('src="/media/bulten.jpg"')
    expect(pictured).toContain('loading="lazy"')

    const bare = home(box({ variant: "image_card", ...LOOK, image: null }))
    expect(bare).toContain('data-news="split"')
    expect(bare).not.toContain("<img")
  })

  it("draws the strip in one row with an envelope, no promise line", () => {
    const html = home(box({ variant: "strip", ...LOOK, note: null }))

    expect(html).toContain('data-news="strip"')
    expect(html).toContain("gf-news-small")
    expect(html).toContain("lucide-mail")
    expect(html).not.toContain("Ayda birkaç")
  })

  it("draws a footer column box sent to a page as today's", () => {
    const html = home(box({ variant: "in_footer", ...LOOK }))
    expect(html).not.toContain("data-news=")
  })
})

describe("the newsletter box's variants in the footer", () => {
  const news = (variant: "split" | "in_footer" | "standard") => ({
    title: "Bültene katılın",
    text: "Onay metni.",
    variant,
    ...LOOK,
  })

  it("draws a band at the ledger's top, or small in its contact column", () => {
    const band = footerOf(shopFixture({ newsletter: news("split") }))
    expect(band).toContain('data-variant="ledger"')
    expect(band).toContain('data-news="split"')
    expect(band).toContain('id="bulten"')

    const column = footerOf(shopFixture({ newsletter: news("in_footer") }))
    expect(column).toContain('data-news="in_footer"')
    expect(column.indexOf('id="footer-contact"')).toBeLessThan(column.indexOf('id="bulten"'))
  })

  it("draws the column box in the brand columns footer's brand block, the strip without it", () => {
    const html = footerOf(
      shopFixture({
        newsletter: news("in_footer"),
        footerBar: {
          id: "mainfooter",
          variant: "brand_columns",
          columns: { topStrip: true, about: null, ground: "well", badgeStyle: "card" },
        },
      })
    )
    const brand = html.indexOf('id="footer-brand"')
    const box = html.indexOf('data-news="in_footer"')
    expect(brand).toBeGreaterThan(-1)
    expect(box).toBeGreaterThan(brand)
    expect(html).toMatch(CONSENT)
  })

  it("keeps today's footer box when the variant is the standard one", () => {
    const html = footerOf(shopFixture({ newsletter: news("standard") }))
    expect(html).not.toContain("data-news=")
    expect(html).not.toContain(LOOK.description)
  })
})
