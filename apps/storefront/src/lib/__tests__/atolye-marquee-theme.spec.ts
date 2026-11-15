import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { MARQUEE_DEFAULTS } from "@qticaret/types/section-marquee"
import type { HomeSectionView, MarqueeSectionView } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The scrolling strip in Atölye (adr/0049 Ek 2026-11-14 §4.1): CSS slides
 * it, each item is written once for assistive tech, the loop's copies are
 * hidden and inert, the steps are attributes, a pause button is there.
 */

const strip = (over: Partial<MarqueeSectionView> = {}): MarqueeSectionView => ({
  ...MARQUEE_DEFAULTS,
  id: "kayan1",
  type: "marquee",
  items: [
    {
      icon: "truck",
      text: "1.500 TL üzeri kargo bedava",
      subtext: "Hafta içi 16.00'ya kadar aynı gün",
      link: { label: "Kargo", path: "/kargo" },
    },
    { icon: null, text: "30 gün içinde iade", subtext: null, link: null },
  ],
  speed: "medium",
  direction: "left",
  ground: "stage",
  size: "medium",
  separator: "dot",
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

// The strip's stylesheet and its separators, buttons and newer settings beside it
const MARQUEE_CSS = ["marquee.css", "marquee-options.css"]
  .map((file) =>
    readFileSync(
      path.resolve(import.meta.dirname, "../../../../../packages/themes/atolye/src", file),
      "utf8"
    )
  )
  .join("\n")

const count = (html: string, needle: string) => html.split(needle).length - 1

describe("the scrolling strip in Atölye", () => {
  it("names its steps as attributes on the band, never inline style", () => {
    const html = home([strip({ size: "large", ground: "primary", direction: "right" })])
    const band = /<section aria-label="Kayan duyurular"[^>]*>/.exec(html)?.[0] ?? ""

    expect(band).toContain('data-size="large"')
    expect(band).toContain('data-ground="primary"')
    expect(band).toContain('data-direction="right"')
    expect(band).toContain('data-speed="medium"')
    expect(band).toContain('data-separator="dot"')
    expect(band).toMatch(/data-span="[0-9.]+"/)
    expect(html).not.toMatch(/<section[^>]*gf-marquee[^>]*style=/)
  })

  it("writes each item once to assistive tech: every other copy hidden and inert", () => {
    const html = home([strip()])
    const links = [...html.matchAll(/<a href="\/kargo"[^>]*>/g)]
    const copies = [...html.matchAll(/<ul class="gf-marquee-copy"([^>]*)>/g)]

    expect(copies).toHaveLength(2)
    expect(copies[0]?.[1]).toBe("")
    expect(copies[1]?.[1]).toContain('aria-hidden="true"')
    expect(copies[1]?.[1]).toContain("inert")
    // The rounds that fill a wide screen inside the first copy are hidden too
    const shown = html
      .split('<ul class="gf-marquee-copy" aria-hidden')[0]
      ?.split(/<li data-part="item" class="gf-marquee-item"(?! data-loop)/)
    expect((shown?.length ?? 0) - 1).toBe(2)
    expect(links.length).toBeGreaterThan(1)
    expect(count(html, "30 gün içinde iade")).toBe(links.length)
  })

  it("carries a pause button and the trust badges' icon", () => {
    const html = home([strip()])

    expect(html).toContain('aria-label="Kayan yazıyı durdur"')
    expect(html).toContain('class="gf-marquee-toggle"')
    expect(html).toContain("gf-marquee-icon")
  })

  it("stands edge to edge, or in the container with corners when the shop boxed it", () => {
    expect(home([strip()])).not.toContain("gf-marquee--boxed")
    expect(home([{ ...strip(), look: { width: "boxed" } }])).toContain("gf-marquee--boxed")
  })

  it("draws the header group's strip above the shop's header, and none on the checkout", () => {
    const frame = renderFrame(atolyeTheme, shopFixture({ marquee: strip({ size: "small" }) }))
    const at = frame.indexOf('data-size="small"')

    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(frame.indexOf("<header"))
    expect(
      renderFrame(atolyeTheme, shopFixture({ marquee: strip(), checkout: true }))
    ).not.toContain("gf-marquee")
  })

  it("maps every step onto the stylesheet, stops on hover and focus, keeps still on reduced motion", () => {
    for (const [name, steps] of Object.entries({
      size: ["small", "medium", "large"],
      ground: ["primary", "well", "stage"],
      speed: ["slowest", "slow", "fast", "fastest"],
      direction: ["right"],
      separator: ["dot", "star", "line"],
      span: ["1.5", "2", "3", "4", "6", "8"],
    })) {
      for (const step of steps) {
        expect(MARQUEE_CSS).toContain(`[data-${name}="${step}"]`)
      }
    }
    expect(MARQUEE_CSS).toContain(".gf-marquee-view:hover .gf-marquee-track")
    // A focused item stops the loop and is scrolled to; the pause button does not stop it
    expect(MARQUEE_CSS).toMatch(
      /\.gf-marquee-view:focus-within \.gf-marquee-track \{\s*animation: none/
    )
    expect(MARQUEE_CSS).not.toContain(".gf-marquee:focus-within")
    expect(MARQUEE_CSS).toContain(".gf-marquee[data-paused] .gf-marquee-track")
    expect(MARQUEE_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
  })
})
