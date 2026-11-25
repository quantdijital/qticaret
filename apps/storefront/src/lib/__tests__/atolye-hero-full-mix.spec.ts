import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { HERO_FULL_DEFAULTS } from "@qticaret/types/section-hero-full"
import type { HeroFullSettings, StoreThemeSettings } from "@qticaret/types"
import type { HeroFullView, HomeSectionView } from "@qticaret/ui"
import { accentDeclarations } from "@/lib/views/accent"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The full image opening's later steps (the Rota look, sahip 2026-11-25):
 * the mixed heading (`title_mix`), each drawn only once chosen; the
 * defaults draw the opening as before them.
 */

const full = (settings: Partial<HeroFullSettings> = {}): HeroFullView => ({
  settings: { ...HERO_FULL_DEFAULTS, ...settings },
  accent: "sınır tanımadan.",
  search: null,
  trust: [],
  video: null,
})

const cover = (view: HeroFullView): HomeSectionView => ({
  id: "kapak",
  type: "hero",
  eyebrow: null,
  heading: "Anadolu",
  intro: "Size göre kurulan yolculuklar.",
  actions: [{ label: "Turumu planla", path: "/magaza" }],
  image: null,
  variant: "full_image",
  full: view,
})

const home = (view: HeroFullView) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: [cover(view)] } })

const sectionTag = (html: string) => /<section[^>]*class="gf-cover[^>]*>/.exec(html)?.[0] ?? ""
const heading = (html: string) => /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? ""

describe("the opening's mixed heading", () => {
  it("draws the accent inline after the heading, in one h1, marked for its stylesheet", () => {
    const html = home(full({ title_mix: "serif_accent" }))
    expect(sectionTag(html)).toContain('data-title-mix="serif_accent"')
    expect(html.match(/<h1/g)).toHaveLength(1)
    const words = heading(html)
    expect(words).toContain('<span class="gf-cover-accent">sınır tanımadan.</span>')
    expect(words).not.toContain("block")
  })

  it("draws the accent as its own coloured line by default, unmarked", () => {
    const html = home(full())
    expect(sectionTag(html)).not.toContain("data-title-mix")
    expect(heading(html)).not.toContain("gf-cover-accent")
    expect(heading(html)).toContain("block")
  })

  it("sets the accent in the accent face's italic, under the setting's mark only", () => {
    const css = atolyeCss("hero-full-mix.css").replace(/\/\*[\s\S]*?\*\//g, "")
    for (const selector of css.split("{").slice(0, -1)) {
      const name = selector.split("}").at(-1)?.trim() ?? ""
      expect(name).toContain('.gf-cover[data-title-mix="serif_accent"]')
    }
    expect(css).toContain("font-family: var(--font-accent, var(--font-heading))")
    expect(css).toContain("font-style: italic")
  })

  it("gives a serif accent face a serif fallback, a handwriting one cursive", () => {
    const theme = (accent: string) =>
      ({ typography: { heading: "inter", body: "inter", accent } }) as unknown as StoreThemeSettings
    expect(accentDeclarations(theme("playfair"))).toEqual([
      "--font-accent:var(--font-playfair), serif",
    ])
    expect(accentDeclarations(theme("caveat"))).toEqual([
      "--font-accent:var(--font-caveat), cursive",
    ])
    expect(accentDeclarations(theme("none"))).toEqual([])
  })
})
