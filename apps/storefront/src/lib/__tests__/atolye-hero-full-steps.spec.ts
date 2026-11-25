import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { HERO_FULL_DEFAULTS } from "@qticaret/types/section-hero-full"
import type { HeroFullSettings } from "@qticaret/types"
import type { HeroFullView, HomeSectionView, TrustBadgeView } from "@qticaret/ui"
import { atolyeCss, ruleBody } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

// The full image opening's later steps: the play button, the stacked title,
// the trust row inside, the corner note and the side scrim. Each default is
// today's drawing (atolye-hero-full.spec.ts).

const BADGES: TrustBadgeView[] = [
  { icon: "shield", title: "Güvenli ödeme", text: "3D Secure" },
  { icon: "truck", title: "Hızlı kargo", text: null },
]

const full = (
  settings: Partial<HeroFullSettings> = {},
  parts: Partial<Omit<HeroFullView, "settings">> = {}
): HeroFullView => ({
  settings: { ...HERO_FULL_DEFAULTS, ...settings },
  accent: "Yolculuk",
  search: null,
  trust: [],
  video: null,
  ...parts,
})

const cover = (view: HeroFullView): HomeSectionView => ({
  id: "kapak",
  type: "hero",
  eyebrow: null,
  heading: "Sınırların Ötesine",
  intro: "Nefes kesen yerler.",
  actions: [
    { label: "Turları keşfet", path: "/magaza" },
    { label: "Videoyu izle", path: "/sayfa/hakkimizda" },
  ],
  image: null,
  variant: "full_image",
  full: view,
})

const home = (view: HeroFullView) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: [cover(view)] } })

const sectionTag = (html: string) => /<section[^>]*class="gf-cover[^>]*>/.exec(html)?.[0] ?? ""

describe("the full image opening's later steps", () => {
  it("draws today's opening at every default", () => {
    const html = home(full({}, { trust: BADGES, note: { text: "Anı biriktir", hand: true } }))

    expect(html).not.toContain("gf-btn--play")
    expect(html).not.toContain("gf-play-ring")
    expect(html).not.toContain("gf-cover-title--stacked")
    expect(html).not.toContain("gf-cover-note")
    expect(html).not.toContain("gf-cover-trust")
    expect(sectionTag(html)).not.toContain("data-trust")
    expect(sectionTag(html)).toContain('data-foot=""')
  })

  it("draws the second button clear after a ringed play mark", () => {
    const html = home(full({ second_button: "play" }))

    expect(html).toContain("gf-btn gf-btn--quiet gf-btn--play")
    expect(html).toContain('class="gf-play-ring"')
    expect(html).toContain("Videoyu izle")
  })

  it("stacks the title, its accent line in the highlight colour", () => {
    const html = home(full({ title_style: "stacked" }))

    expect(html).toContain("gf-cover-title--stacked")
    expect(html).not.toContain("max-w-[20ch]")
    expect(html).toContain("text-(--highlight)")
  })

  it("puts the trust badges in a row under the buttons, none over the bottom edge", () => {
    const html = home(full({ trust_place: "inside" }, { trust: BADGES }))

    expect(sectionTag(html)).toContain('data-trust="inside"')
    expect(sectionTag(html)).not.toContain("data-foot")
    expect(html).toContain("gf-cover-trust")
    expect(html).toContain("Güvenli ödeme")
    expect(html).not.toContain("shadow-float")
  })

  it("moves the hand note to the top corner from 1024 px, over the heading below it", () => {
    const html = home(
      full({ note_place: "corner" }, { note: { text: "Anı biriktir", hand: true } })
    )

    expect(html).toContain("gf-cover-note")
    expect(html.match(/Anı biriktir/g)?.length).toBe(2)
    expect(home(full({ note_place: "corner" }))).not.toContain("gf-cover-note")
  })

  it("names the side scrim and veils the photograph from the words' side", () => {
    expect(sectionTag(home(full({ scrim: "side" })))).toContain('data-scrim="side"')
    const css = atolyeCss("hero-full.css")
    expect(
      ruleBody(css, '.gf-cover[data-side="full"][data-scrim="side"] .gf-cover-media::after')
    ).toContain("linear-gradient")
  })
})
