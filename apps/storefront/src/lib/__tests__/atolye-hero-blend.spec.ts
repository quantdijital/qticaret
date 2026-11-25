import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { HERO_FULL_DEFAULTS } from "@qticaret/types/section-hero-full"
import type { HeroFullSettings } from "@qticaret/types"
import type { HeroFullView, HomeSectionView, ImageView, TrustBadgeView } from "@qticaret/ui"
import { SEARCH_FORM_DEFAULTS } from "@qticaret/types/search-form"
import { t } from "@/lib/i18n"
import { EMPTY_VALUES, searchFormView } from "@/lib/views/search-form"
import { atolyeCss, ruleBody } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The full image opening's later steps (adr/0077 §9): the photograph
 * blended under the words (`image_side: blend`), the buttons and the
 * search box together (`action: both`), the accent button with its arrow,
 * the curl under the accent line and the sprig of leaves; each off, the
 * opening as before.
 */

const picture: ImageView = {
  src: "/media/vadi.jpg",
  alt: "Vadi",
  width: 1600,
  height: 900,
  sources: { avif: null, webp: null },
}

const FORM = searchFormView(
  {
    settings: { ...SEARCH_FORM_DEFAULTS },
    booking: false,
    categories: [],
    where: null,
    today: "2026-11-24",
  },
  EMPTY_VALUES,
  t
)

const BADGES: TrustBadgeView[] = [
  { icon: "shield", title: "Güvenli ödeme", text: null },
  { icon: "truck", title: "Hızlı kargo", text: null },
]

const full = (
  settings: Partial<HeroFullSettings> = {},
  parts: Partial<Omit<HeroFullView, "settings">> = {}
): HeroFullView => ({
  settings: { ...HERO_FULL_DEFAULTS, ...settings },
  accent: null,
  search: null,
  trust: [],
  video: null,
  ...parts,
})

const cover = (view: HeroFullView, over: Partial<HomeSectionView> = {}): HomeSectionView =>
  ({
    id: "kapak",
    type: "hero",
    eyebrow: null,
    heading: "Doğayı keşfet.",
    intro: null,
    actions: [
      { label: "Turları keşfet", path: "/magaza" },
      { label: "Hikâyemiz", path: "/sayfa/hakkimizda" },
    ],
    image: picture,
    variant: "full_image",
    full: view,
    ...over,
  }) as HomeSectionView

const home = (view: HeroFullView, over: Partial<HomeSectionView> = {}) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: [cover(view, over)] } })

const sectionTag = (html: string) => /<section[^>]*class="gf-cover[^>]*>/.exec(html)?.[0] ?? ""

describe("Atölye's blended full image opening", () => {
  it("runs the photograph under the words, washed by the page's ground, the words in its inks", () => {
    const html = home(full({ image_side: "blend" }, { accent: "Kendi rotanı bul." }))

    expect(sectionTag(html)).toContain('data-side="blend"')
    expect(html).toMatch(/class="gf-cover-media[^"]*lg:inset-0[^"]*bg-media"/)
    expect(html).toContain("gf-cover-wash")
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain("gf-stage")
    expect(html).toContain('<span class="block text-signal">Kendi rotanı bul.</span>')
  })

  it("draws the stage alone, as the full opening, when there is no photograph to blend", () => {
    const html = home(full({ image_side: "blend" }), { image: null })

    expect(sectionTag(html)).toContain('data-side="full"')
    expect(html).not.toContain("gf-cover-wash")
  })

  it("draws the buttons and then the search box with `both`", () => {
    const html = home(full({ action: "both", image_side: "blend" }, { search: FORM }))

    expect(html).toContain("gf-btn--quiet")
    expect(html.match(/<form/g)).toHaveLength(1)
    expect(html.indexOf("Turları keşfet")).toBeLessThan(html.indexOf("<form"))
  })

  it("fills the first button with the accent and gives it an arrow, each only when asked", () => {
    const html = home(full({ button_tone: "accent", button_icon: "arrow" }))
    const first = /<a href="\/magaza" class="([^"]*)">Turları keşfet(.*?)<\/a>/.exec(html)

    expect(first?.[1]).toBe("gf-btn gf-btn--accent")
    expect(first?.[2]).toContain("<svg")
    expect(html).toContain('<a href="/sayfa/hakkimizda" class="gf-btn gf-btn--quiet">Hikâyemiz</a>')

    const plain = home(full())
    expect(plain).toContain('<a href="/magaza" class="gf-btn">Turları keşfet</a>')
    expect(plain).not.toContain("gf-btn--accent")
  })

  it("curls a line under the accent line, and draws the leaves, only when asked", () => {
    const html = home(
      full({ image_side: "blend", accent_mark: "swash", ornament: "leaves" }, { accent: "Bul." })
    )

    expect(html).toContain('<span class="relative inline-block">Bul.<svg')
    expect(html).toContain("gf-cover-swash")
    expect(html).toContain("gf-cover-leaves")

    const plain = home(full({ image_side: "blend" }, { accent: "Bul." }))
    expect(plain).not.toContain("gf-cover-swash")
    expect(plain).not.toContain("gf-cover-leaves")
  })

  it("centres the trust box under a blended opening's search inside it, roomy", () => {
    const html = home(
      full({ action: "search", image_side: "blend" }, { search: FORM, trust: BADGES })
    )
    const box = /<ul aria-label="[^"]+" class="([^"]*)"/.exec(html)?.[1] ?? ""

    expect(box).toContain("mx-auto")
    expect(box).toContain("lg:w-[76%]")
    expect(box).toContain("lg:py-7")
  })

  it("keeps the trust box of an opening not blended as it was", () => {
    const html = home(full({ action: "search" }, { search: FORM, trust: BADGES }))
    const box = /<ul aria-label="[^"]+" class="([^"]*)"/.exec(html)?.[1] ?? ""

    expect(box).not.toContain("lg:py-7")
    expect(html).not.toContain("lg:size-10")
  })

  it("names the wash's hazes after the opening and sets the leaves by the words", () => {
    const html = home(
      full({ image_side: "blend", ornament: "leaves" }, { search: FORM, trust: BADGES })
    )

    expect(html).toContain('id="bolum-kapak-wash-x"')
    expect(html).toContain('mask="url(#bolum-kapak-wash-m)"')
    // The words' column holds the sprig, so it never lands on them
    expect(html).toMatch(
      /<div class="flex flex-col gap-4 lg:gap-5 relative[^"]*"><svg[^>]*gf-cover-leaves/
    )
  })
})

describe("the blended opening's stylesheet", () => {
  const css = atolyeCss("hero-full.css")

  it("holds the blend's height from 1024 px and draws no mask over its wash", () => {
    expect(css).toContain('.gf-cover:is([data-side="end"], [data-side="blend"]) .gf-cover-stage')
    expect(ruleBody(css, '.gf-cover[data-side="blend"] .gf-cover-media')).toContain(
      "mask-image: none"
    )
  })

  it("paints the accent button in the shop's accent, its hover a deep step of it", () => {
    const body = ruleBody(css, ".gf-cover .gf-btn--accent")

    expect(body).toContain("background: var(--highlight)")
    expect(body).toContain("--color-signal-deep: color-mix(in oklab, var(--highlight) 86%, black)")
  })
})
