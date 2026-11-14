import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { MARQUEE_DEFAULTS } from "@qticaret/types/section-marquee"
import type { HomeSectionView, MarqueeSectionView } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The scrolling strip's newer settings in Atölye (adr/0049 Ek 2026-11-15):
 * each an attribute the stylesheet maps, the screens and a closed strip
 * taking its outermost box off the page, a close button when offered, the
 * pause button always there.
 */

const strip = (over: Partial<MarqueeSectionView> = {}): MarqueeSectionView => ({
  ...MARQUEE_DEFAULTS,
  id: "kayan1",
  type: "marquee",
  items: [
    { icon: null, text: "Kargo bedava", subtext: null, link: null },
    { icon: null, text: "İade 30 gün", subtext: null, link: null },
    { icon: null, text: "Taksit", subtext: null, link: null },
  ],
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const band = (html: string) => /<section aria-label="Kayan duyurular"[^>]*>/.exec(html)?.[0] ?? ""

const OPTIONS_CSS = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../../../packages/themes/atolye/src/marquee-options.css"
  ),
  "utf8"
)

/** The items one copy of the loop holds. */
const copyItems = (html: string) =>
  (
    html
      .split('<ul class="gf-marquee-copy" aria-hidden')[0]
      ?.split('<ul class="gf-marquee-copy">')[1] ?? ""
  ).split('data-part="item"').length - 1

describe("the scrolling strip's newer settings in Atölye", () => {
  it("names each as an attribute, its defaults drawing the strip as before", () => {
    const html = home([
      strip({
        hover_pause: "off",
        pause_button: "hover",
        weight: "normal",
        uppercase: "on",
        gap: "wide",
      }),
    ])

    expect(band(html)).toContain('data-hover-pause="off"')
    expect(band(html)).toContain('data-pause-button="hover"')
    expect(band(html)).toContain('data-weight="normal"')
    expect(band(html)).toContain('data-uppercase="on"')
    expect(band(html)).toContain('data-gap="wide"')
    expect(band(home([strip()]))).toContain('data-pause-button="always"')
    expect(html).not.toMatch(/<section[^>]*gf-marquee[^>]*style=/)
  })

  it("keeps the pause button whatever the shop picks (WCAG 2.2.2)", () => {
    for (const pause of ["always", "hover"] as const) {
      expect(home([strip({ pause_button: pause })])).toContain('aria-label="Kayan yazıyı durdur"')
    }
  })

  it("outlines every other item only at the large size, a copy holding an even count", () => {
    const large = home([strip({ size: "large", outline: "on" })])

    expect(band(large)).toContain('data-outline="on"')
    expect(copyItems(large) % 2).toBe(0)
    expect(band(home([strip({ size: "medium", outline: "on" })]))).not.toContain("data-outline")
  })

  it("holds fewer rounds with wide room, more with tight", () => {
    const tight = copyItems(home([strip({ size: "small", gap: "tight" })]))
    const wide = copyItems(home([strip({ size: "small", gap: "wide" })]))

    expect(tight).toBeGreaterThan(wide)
  })

  it("puts the screens on the outermost box, on a page and in the header", () => {
    expect(home([strip({ device: "mobile" })])).toMatch(
      /<div class="pt-\(--section-gap-s\)" data-mq-shell="" data-device="mobile">/
    )
    const frame = renderFrame(
      atolyeTheme,
      shopFixture({ marquee: strip({ size: "small", device: "desktop" }) })
    )
    expect(band(frame)).toContain('data-mq-shell=""')
    expect(band(frame)).toContain('data-device="desktop"')
  })

  it("draws a close button only when the shop offers one", () => {
    expect(home([strip()])).not.toContain("Kayan yazıyı kapat")
    const html = home([strip({ closable: "on" })])
    expect(html).toMatch(/<button[^>]*data-part="close"[^>]*aria-label="Kayan yazıyı kapat"/)
  })

  it("maps every step onto the stylesheet", () => {
    for (const rule of [
      '[data-weight="normal"]',
      '[data-uppercase="on"]',
      '[data-gap="tight"]',
      '[data-gap="wide"]',
      '[data-outline="on"]',
      '[data-device="mobile"]',
      '[data-device="desktop"]',
      '[data-pause-button="hover"]',
      "[data-closed]",
    ]) {
      expect(OPTIONS_CSS).toContain(rule)
    }
    // The pause button hides only where there is hover; touch screens always show it
    expect(OPTIONS_CSS).toMatch(
      /@media \(hover: hover\) \{\s*\.gf-marquee\[data-pause-button="hover"\]/
    )
    expect(OPTIONS_CSS).toContain(':focus-within [data-part="button"]')
    // Outlined only where the browser strokes text
    expect(OPTIONS_CSS).toMatch(/@supports \(-webkit-text-stroke/)
    expect(OPTIONS_CSS).toContain("text-transform: uppercase")
  })
})
