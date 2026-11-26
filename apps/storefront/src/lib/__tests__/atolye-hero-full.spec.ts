import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { HERO_FULL_DEFAULTS } from "@qticaret/types/section-hero-full"
import type { HeroFullSettings } from "@qticaret/types"
import type {
  HeroFullView,
  HomeSectionView,
  ImageView,
  SearchFormView,
  TrustBadgeView,
} from "@qticaret/ui"
import { SEARCH_FORM_DEFAULTS } from "@qticaret/types/search-form"
import { t } from "@/lib/i18n"
import { EMPTY_VALUES, searchFormView } from "@/lib/views/search-form"
import { atolyeCss, ruleBody } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The opening's full image in Atölye (adr/0077 §9, "Tam görsel"): each
 * setting as the theme draws it, the heading one h1 with its accent line,
 * the buttons or the shop's one search box, the trust box, and the other
 * two openings untouched.
 */

const picture: ImageView = {
  src: "/media/vadi.jpg",
  alt: "Vadi",
  width: 1600,
  height: 900,
  sources: { avif: "/media/vadi-800.avif 800w", webp: null },
}

const FORM: SearchFormView = searchFormView(
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
  { icon: "shield", title: "Güvenli ödeme", text: "3D Secure" },
  { icon: "truck", title: "Hızlı kargo", text: null },
]

type Hero = Extract<HomeSectionView, { type: "hero" }>

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

const cover = (view: HeroFullView = full(), over: Partial<Hero> = {}): HomeSectionView => ({
  id: "kapak",
  type: "hero",
  eyebrow: "Dünyayı keşfet",
  heading: "Doğayı keşfet.",
  intro: "Nefes kesen yerler, unutulmaz deneyimler.",
  actions: [
    { label: "Hemen keşfet", path: "/magaza" },
    { label: "Hikâyemiz", path: "/sayfa/hakkimizda" },
  ],
  image: picture,
  variant: "full_image",
  full: view,
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const sectionTag = (html: string) => /<section[^>]*class="gf-cover[^>]*>/.exec(html)?.[0] ?? ""

describe("Atölye's full image opening", () => {
  it("names every setting's default step on the section", () => {
    const tag = sectionTag(home([cover()]))

    expect(tag).toContain('data-side="full"')
    expect(tag).toContain('data-height="screen"')
    expect(tag).toContain('data-scrim="light"')
    expect(tag).toContain('data-edge="straight"')
    expect(tag).not.toContain("data-foot")
  })

  it.each([
    ["height", "tall", 'data-height="tall"'],
    ["scrim", "strong", 'data-scrim="strong"'],
    ["edge", "wave", 'data-edge="wave"'],
    ["image_side", "end", 'data-side="end"'],
  ] as const)("names %s's %s step", (name, step, mark) => {
    expect(sectionTag(home([cover(full({ [name]: step }))]))).toContain(mark)
  })

  it("is the page's one h1, its accent line a line of the same heading in the shop's colour", () => {
    const html = home([cover(full({}, { accent: "Kaçışını bul." }))])

    expect(html.match(/<h1/g)).toHaveLength(1)
    const heading = /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? ""
    expect(heading).toContain("<span>Doğayı keşfet.</span>")
    expect(heading).toContain('<span class="block text-signal-on-stage">Kaçışını bul.</span>')
    // No accent, no second line
    expect(home([cover()])).not.toContain("text-signal-on-stage")
  })

  it("preloads its picture and asks for it first; a later opening is an h2 with a lazy one", () => {
    const html = home([cover()])

    expect(html).toMatch(/<link rel="preload" as="image" href="\/media\/vadi\.jpg"/)
    expect(html.match(/rel="preload"/g)).toHaveLength(1)
    expect(html).toMatch(/<img[^>]*fetchPriority="high"/i)

    const second = home([cover(), cover(full(), { id: "ikinci" })])
    expect(second.match(/<h1/g)).toHaveLength(1)
    expect(second.match(/rel="preload"/g)).toHaveLength(1)
    expect(second).toContain('<h2 id="bolum-ikinci"')
  })

  it("draws the graphite stage alone when the shop gave no picture", () => {
    const html = home([cover(full(), { image: null })])

    expect(html).not.toContain("<img")
    expect(html).not.toContain('rel="preload"')
    expect(html).toMatch(/class="gf-cover-media[^"]*bg-stage"/)
  })

  it("draws both buttons, the first the main one and the second quiet", () => {
    const html = home([cover()])

    expect(html).toContain('<a href="/magaza" class="gf-btn">Hemen keşfet</a>')
    expect(html).toContain('<a href="/sayfa/hakkimizda" class="gf-btn gf-btn--quiet">Hikâyemiz</a>')
    expect(html).not.toContain("<form")
  })

  it("centres the words or starts them at the edge", () => {
    expect(home([cover()])).toContain("items-center text-center")
    expect(home([cover(full({ align: "start" }))])).not.toContain("text-center")
  })

  it("puts the shop's one search box in the place of the buttons, inside the opening", () => {
    const html = home([cover(full({ action: "search" }, { search: FORM }))])

    expect(html.match(/<form/g)).toHaveLength(1)
    expect(html).toContain('action="/arama"')
    expect(html).not.toContain("gf-btn--quiet")
    expect(html).not.toContain("gf-cover-foot")
    // Off the stage's inks: the box keeps the page's own on its white ground
    const stage = /<div class="[^"]*gf-stage[^"]*">.*?<\/div><form/s.exec(html)?.[0] ?? ""
    expect(stage).not.toBe("")
  })

  it("lifts the search box over the bottom edge as a card when it overlaps", () => {
    const html = home([
      cover(full({ action: "search", search_position: "overlap" }, { search: FORM })),
    ])

    expect(sectionTag(html)).toContain('data-foot=""')
    expect(html.match(/<form/g)).toHaveLength(1)
    expect(html.indexOf("gf-cover-foot")).toBeLessThan(html.indexOf("<form"))
  })

  it("keeps the buttons when the search was asked for but its box did not come", () => {
    const html = home([cover(full({ action: "search", search_position: "overlap" }))])

    expect(html).toContain("gf-btn--quiet")
    expect(html).not.toContain("gf-cover-foot")
  })

  it("shows the shop's trust badges in a floating box over the bottom edge", () => {
    const html = home([cover(full({}, { trust: BADGES }))])

    expect(sectionTag(html)).toContain('data-foot=""')
    const box = /<ul aria-label="[^"]+" class="([^"]*)"/.exec(html)?.[1] ?? ""
    expect(box).toContain("shadow-float")
    expect(box).toContain("bg-field")
    expect(box).toContain("lg:grid-cols-2")
    expect(html).toContain("Güvenli ödeme")
    expect(html).toContain("3D Secure")
    expect(home([cover()])).not.toContain("shadow-float")
  })

  it("stands the words on the page's ground beside a photograph's well", () => {
    const html = home([cover(full({ image_side: "end" }, { accent: "Kaçışını bul." }))])

    expect(html).toMatch(/class="gf-cover-media[^"]*bg-media"/)
    expect(html).not.toContain("gf-stage")
    expect(html).toContain('<span class="block text-signal">Kaçışını bul.</span>')
    expect(html).toContain('imageSizes="(min-width: 1024px) 56vw, 100vw"')
  })

  it("draws the stage alone, as the full opening, when beside the words there is no photograph", () => {
    const none = home([cover(full({ image_side: "end" }), { image: null })])

    expect(sectionTag(none)).toContain('data-side="full"')
    expect(none).not.toContain("<img")
    expect(none).not.toContain("bg-media")
    // No picture's box over the words on a phone: the stage behind them
    expect(none).not.toContain("aspect-[16/10]")
    expect(none).toMatch(/class="gf-cover-media[^"]*absolute inset-0 -z-10[^"]*bg-stage"/)
    expect(none).toContain("gf-stage")
    expect(none).toBe(home([cover(full(), { image: null })]))
  })

  it("marks its fields in the editor's preview only", () => {
    const marked = home([cover(full({}, { accent: "Kaçışını bul." }), { editor: true })])

    for (const key of [
      "image",
      "eyebrow",
      "heading",
      "title_accent",
      "text",
      "links.0",
      "links.1",
    ]) {
      expect(marked).toContain(`data-qf="${key}"`)
    }
    expect(home([cover()])).not.toContain("data-qf")
  })

  it("falls back to today's opening when its parts did not come", () => {
    const html = home([cover(full(), { full: null })])

    expect(html).not.toContain("gf-cover")
    expect(html).toContain("gf-stage relative grid")
  })
})

describe("the other openings", () => {
  it("draw as before: nothing of the full image on them", () => {
    const html = home([cover(full(), { variant: "standard" })])

    expect(html).not.toContain("gf-cover")
    expect(html).toContain("gf-stage relative grid")
    expect(html).not.toContain("gf-btn--quiet")
  })
})

describe("the full image's stylesheet", () => {
  const css = atolyeCss("hero-full.css")

  it("writes every rule under the opening's own class", () => {
    const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/^\s*(\.[^{@]+)\{/gm)]
    expect(selectors.length).toBeGreaterThan(8)
    for (const [, selector = ""] of selectors) {
      expect(selector.trim().startsWith(".gf-cover"), selector).toBe(true)
    }
    expect(atolyeCss("styles.css")).toContain('@import "./hero-full.css";')
  })

  it("veils the photograph only behind the words, stronger at the strong step", () => {
    expect(ruleBody(css, '.gf-cover[data-side="full"] .gf-cover-media::after')).toContain(
      "var(--cover-veil)"
    )
    expect(ruleBody(css, '.gf-cover[data-scrim="strong"]')).toContain("--cover-veil: 64%;")
  })

  it("waves the photograph's edge with a mask on its own box, never a hover underline", () => {
    expect(ruleBody(css, '.gf-cover[data-edge="wave"] .gf-cover-media')).toContain("mask-image:")
    expect(css).not.toContain("text-decoration")
    expect(css).not.toContain(":hover")
  })

  it("rounds the play button's hover ground with its ring and eases it in, still when asked", () => {
    expect(ruleBody(css, ".gf-cover .gf-btn--play")).toContain("min-height: calc(2.75rem + 2px)")
    const eased = ruleBody(css, ".gf-cover .gf-btn.gf-btn--play")
    expect(eased).toContain("background-color var(--dur-short) ease")
    expect(eased).toContain("box-shadow var(--dur-short) ease")
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.gf-cover \.gf-btn\.gf-btn--play \{\s*transition: none;/
    )
  })
})
