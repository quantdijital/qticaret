import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { MARQUEE_DEFAULTS } from "@qticaret/types/section-marquee"
import type { HomeSectionView } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * A thin strip's gaps in Atölye (sahip 2026-11-16): a section with no
 * heading whose body is one slim row (the marquee, the trust strip in both
 * its drawings) marks its outermost box `data-thin`; `thin.css` gives it
 * and the section after it the small section gap, a step the shop set
 * winning. Headed sections keep the one gap.
 */

const SRC = path.resolve(import.meta.dirname, "../../../../../packages/themes/atolye/src")
const THIN_CSS = readFileSync(path.join(SRC, "thin.css"), "utf8")
const STYLES_CSS = readFileSync(path.join(SRC, "styles.css"), "utf8")

const marquee = {
  ...MARQUEE_DEFAULTS,
  id: "kayan1",
  type: "marquee",
  items: [{ icon: null, text: "Kargo bedava", subtext: null, link: null }],
} satisfies HomeSectionView

const badges = (variant: "strip" | "lined"): HomeSectionView => ({
  id: `guven-${variant}`,
  type: "trust_badges",
  variant,
  badges: [{ icon: "truck", title: "Ücretsiz kargo", text: null }],
})

const brands: HomeSectionView = {
  id: "markalar",
  type: "brands",
  title: "Markalar",
  brands: [{ label: "A", path: "/marka/a" }],
}

const faq: HomeSectionView = {
  id: "sss1",
  type: "faq",
  title: "Sorular",
  items: [{ question: "Kargo ne zaman?", answer: "Aynı gün." }],
}

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const thinCount = (html: string) => (html.match(/data-thin=""/g) ?? []).length

/** The rule body of the first rule whose selector holds `selector`. */
const ruleOf = (selector: string) => {
  const at = THIN_CSS.indexOf(selector)
  return at < 0 ? "" : THIN_CSS.slice(at, THIN_CSS.indexOf("}", at))
}

describe("a thin strip's gaps in Atölye", () => {
  it("marks the marquee and both trust strip drawings thin, and no headed section", () => {
    expect(thinCount(home([faq, marquee, brands]))).toBe(1)
    expect(home([faq, marquee])).toMatch(/<div class="gf-section" data-thin="" data-mq-shell=""/)
    for (const variant of ["strip", "lined"] as const) {
      const html = home([faq, badges(variant), brands])
      expect(html).toMatch(/<section aria-label="[^"]*" data-thin="" class="gf-section">/)
      expect(thinCount(html)).toBe(1)
    }
    expect(thinCount(home([faq, brands]))).toBe(0)
  })

  it("keeps the trust strip close under a picture opening, still thin for what follows", () => {
    const hero: HomeSectionView = {
      id: "acilis",
      type: "hero",
      eyebrow: null,
      heading: "El yapımı ürünler",
      intro: null,
      actions: [],
      image: null,
    }
    const html = home([hero, badges("strip"), brands])
    expect(html).toMatch(/data-thin="" class="pt-3 lg:pt-4"/)
  })

  it("leaves the marquee above the header unmarked: it has no gap of its own", () => {
    const frame = renderFrame(atolyeTheme, shopFixture({ marquee: { ...marquee, size: "small" } }))
    expect(frame).not.toContain('data-thin=""')
  })

  it("loads after the look's rules", () => {
    expect(STYLES_CSS.indexOf('@import "./thin.css"')).toBeGreaterThan(
      STYLES_CSS.indexOf('@import "./look.css"')
    )
  })

  it("gives the strip the small step above it, on its band's box and inside the band", () => {
    expect(ruleOf(".gf-section[data-thin] {")).toContain(
      "padding-top: var(--section-top, var(--section-gap-s));"
    )
    expect(ruleOf(".gf-look[data-ground]:not([data-outer]):has(> [data-thin]) {")).toContain(
      "margin-top: var(--look-outer, var(--section-gap-s));"
    )
    expect(ruleOf(".gf-look[data-ground]:not([data-inner]):has(> [data-thin]) {")).toContain(
      "padding-block: var(--section-gap-s);"
    )
  })

  it("gives the next section the same small step, the shop's steps and hidden strips aside", () => {
    for (const [screen, hidden] of [
      ["(width >= 64rem)", "mobile"],
      ["(width < 64rem)", "desktop"],
    ] as const) {
      const block = THIN_CSS.slice(THIN_CSS.indexOf(`@media ${screen}`))
      const visible = `[data-thin]:not([data-device="${hidden}"], [data-closed])`
      // The strip itself, then the box that holds it (not hidden on this screen)
      expect(block).toContain(`${visible} + .gf-section,`)
      expect(block).toContain(`:not([data-show-on="${hidden}"]):has(> ${visible})`)
      // A next section with its own outer step keeps it; a band takes the step on its box
      expect(block).toContain("+ :not([data-outer], [data-ground])")
      expect(block).toContain("+ .gf-look[data-ground]:not([data-outer])")
    }
    // A step the shop set wins: the strip's space below zeroes these, its outer step stands
    expect(THIN_CSS.match(/var\(--section-top, var\(--section-gap-s\)\)/g)).toHaveLength(3)
    expect(THIN_CSS.match(/var\(--look-outer, var\(--section-gap-s\)\)/g)).toHaveLength(3)
  })
})
