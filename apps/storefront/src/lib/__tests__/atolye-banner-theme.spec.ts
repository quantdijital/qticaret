import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { BannerSectionView, ImageView, PlaceOrderResult } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * Atölye's picture band (adr/0049 Ek 2026-11-14 §3.3 E2): the shop's
 * steps as attributes and named classes (no inline style), the defaults
 * the band as it was drawn before them, a phone's own picture only under
 * 640 px, a second button one step quieter than the first.
 */

const picture = (name: string, webp = false): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  sources: { avif: null, webp: webp ? `/media/${name}-800.webp 800w` : null },
})

const band = (over: Partial<BannerSectionView> = {}, slide = {}): BannerSectionView => ({
  id: "afis",
  type: "banner",
  slides: [
    {
      image: picture("genis"),
      mobileImage: null,
      heading: "Kış seçkisi",
      text: "Yeni gelenler",
      link: { label: "Seçkiye git", path: "/kis" },
      secondLink: null,
      tone: "light",
      ...slide,
    },
  ],
  width: "boxed",
  height: "medium",
  text_position: "bottom_left",
  overlay: "medium",
  button_style: "solid",
  ...over,
})

const draw = (section: BannerSectionView) =>
  renderPage(atolyeTheme, "HomePage", {
    view: { sections: [section] },
    subscribe: (): Promise<PlaceOrderResult> =>
      Promise.resolve({ ok: true, error: null, challenge: null }),
  })

describe("Atölye's picture band (adr/0049 Ek 2026-11-14 §3.3 E2)", () => {
  it("draws the defaults as before: in the container, rounded, foot left, a filled button", () => {
    const html = draw(band())
    expect(html).toContain('data-overlay="medium"')
    expect(html).toContain('data-row="bottom"')
    expect(html).toContain('data-column="left"')
    expect(html).toMatch(
      /class="gf-band [^"]*gf-stage[^"]*rounded-tile[^"]*aspect-\[4\/5\][^"]*sm:aspect-\[21\/9\]/
    )
    expect(html).toMatch(/<a href="\/kis" class="gf-btn">Seçkiye git<\/a>/)
    expect(html).not.toContain("style=")
  })

  it("draws a second button one step quieter, per the shop's style", () => {
    const second = { secondLink: { label: "Tümü", path: "/tumu" } }
    expect(draw(band({}, second))).toMatch(/class="gf-btn gf-btn--quiet">Tümü/)
    const outlined = draw(band({ button_style: "outline" }, second))
    expect(outlined).toMatch(/class="gf-btn gf-btn--quiet">Seçkiye git/)
    expect(outlined).toMatch(/class="gf-link">Tümü/)
    expect(draw(band({ button_style: "text" }, second))).toMatch(/class="gf-link">Seçkiye git/)
  })

  it("goes edge to edge without the container's corners, at the shop's height", () => {
    const html = draw(band({ width: "full", height: "high" }))
    expect(html).not.toContain("rounded-tile")
    expect(html).toContain("aspect-[2/3]")
    expect(html).toContain("sm:aspect-[16/9]")
  })

  it("stands the words where the shop put them, dark ones on the counter's veil", () => {
    const html = draw(band({ text_position: "middle_right", overlay: "none" }, { tone: "dark" }))
    expect(html).toContain('data-tone="dark"')
    expect(html).toContain('data-overlay="none"')
    expect(html).toContain('data-row="middle"')
    expect(html).toContain("justify-center")
    expect(html).toContain("items-end")
    expect(html).not.toMatch(/class="gf-band [^"]*gf-stage/)
  })

  it("gives a phone its own picture under 640 px only", () => {
    const html = draw(
      band({}, { image: picture("genis", true), mobileImage: picture("dar", true) })
    )
    expect(html).toContain(
      '<source media="(max-width: 39.99rem)" type="image/webp" srcSet="/media/dar-800.webp 800w" sizes="100vw"/>'
    )
    expect(html).toMatch(/<source type="image\/webp" srcSet="\/media\/genis-800.webp 800w"/)
  })

  it("asks for its picture at once when it opens the page (the LCP), else lazily", () => {
    expect(draw(band())).toMatch(/loading="eager" fetchPriority="high"/)
    const later = renderPage(atolyeTheme, "HomePage", {
      view: {
        sections: [
          { id: "hikaye", type: "rich_text", title: "Neden biz?", html: "<p>Atölyemizden.</p>" },
          band(),
        ],
      },
      subscribe: (): Promise<PlaceOrderResult> =>
        Promise.resolve({ ok: true, error: null, challenge: null }),
    })
    expect(later).toMatch(/loading="lazy" fetchPriority="auto"/)
  })
})
