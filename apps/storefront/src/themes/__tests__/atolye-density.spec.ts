import { describe, expect, it } from "vitest"
import { ATOLYE_SECTION_SCALE, atolyeTheme } from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import { DEFAULT_THEME, themeSettings, themeView } from "@/lib/views/theme"
import { atolyeCss, declared } from "@/test/atolye-css"
import { px, tokenAt } from "@/test/atolye-token-at"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { entry } from "../atolye"

/**
 * The density, the tight section spacing and the corners between sharp
 * and soft (adr/0067 Ek 2026-11-16): new steps beside today's, nothing
 * printed or marked at the defaults, each step's tokens at every width.
 */

const TOKENS = atolyeCss("tokens.css")
const DENSITY = atolyeCss("density.css")
const SHEETS = [TOKENS, DENSITY]

const chosen = (patch: Partial<StoreThemeSettings>): StoreThemeSettings => ({
  ...DEFAULT_THEME,
  ...patch,
})

/** Desktop, the 1024 px edge (Tailwind's `lg:` and the tokens' `max-width` both hold), a tablet, a phone. */
const WIDTHS = { desktop: 1440, edge: 1024, tablet: 768, phone: 390 } as const

type Step = "airy" | "balanced" | "compact"

/** Each token's px at the four widths, per step: the table in `density.css`'s head. */
const EXPECTED: Readonly<Record<string, Readonly<Record<Step, readonly number[]>>>> = {
  "--head-gap": { airy: [40, 40, 24, 24], balanced: [24, 24, 16, 16], compact: [16, 16, 12, 12] },
  "--head-gap-m": { airy: [32, 32, 24, 24], balanced: [24, 24, 16, 16], compact: [16, 16, 12, 12] },
  "--head-gap-s": { airy: [24, 24, 24, 24], balanced: [24, 24, 16, 16], compact: [16, 16, 12, 12] },
  "--gap-columns": { airy: [24, 24, 24, 12], balanced: [20, 16, 16, 12], compact: [16, 12, 12, 8] },
  "--gap-rows": { airy: [40, 40, 32, 32], balanced: [28, 28, 20, 20], compact: [20, 20, 12, 12] },
  "--gap-rows-s": { airy: [32, 32, 32, 32], balanced: [28, 28, 20, 20], compact: [20, 20, 12, 12] },
  "--footer-gap": { airy: [64, 48, 48, 40], balanced: [48, 40, 40, 32], compact: [32, 24, 24, 20] },
  "--gutter": { airy: [48, 24, 24, 16], balanced: [48, 24, 24, 16], compact: [48, 24, 24, 12] },
}

const at = (token: string, step: Step) =>
  Object.values(WIDTHS).map((width) =>
    px(tokenAt(SHEETS, token, width, step === "airy" ? null : `[data-density="${step}"]`))
  )

/** The frame's root element: the first tag the theme's Layout prints. */
const rootTag = (settings: StoreThemeSettings, checkout = false): string => {
  const html = renderFrame(atolyeTheme, shopFixture({ theme: themeView(settings), checkout }))
  return /^<div[^>]*>/.exec(html)?.[0] ?? ""
}

describe("the density (adr/0067 Ek 2026-11-16, S6)", () => {
  it.each(Object.entries(EXPECTED))("sets %s on each step at every width", (token, expected) => {
    for (const step of ["airy", "balanced", "compact"] as const) {
      expect(at(token, step), `${token} ${step}`).toEqual(expected[step])
    }
  })

  it("marks nothing at airy, so today's page prints as before", () => {
    expect(themeSettings({}, null).density).toBe("airy")
    expect(themeSettings({ density: "dense" }, null).density).toBe("airy")
    expect(rootTag(DEFAULT_THEME)).toBe(
      '<div class="flex min-h-dvh flex-col" data-surface="filled">'
    )
    expect(entry.style(DEFAULT_THEME)).toBeNull()
    expect(DENSITY).not.toContain('"airy"')
  })

  it("marks a step off airy on the root element, the checkout's frame too, with no CSS printed", () => {
    expect(rootTag(chosen({ density: "balanced" }))).toBe(
      '<div class="flex min-h-dvh flex-col" data-surface="filled" data-density="balanced">'
    )
    expect(rootTag(chosen({ density: "compact" }), true)).toContain('data-density="compact"')
    expect(entry.style(chosen({ density: "compact" }))).toBeNull()
  })

  it("sets only tokens the theme declares, under the two marks and nothing else", () => {
    const names = new Set([...DENSITY.matchAll(/(--[a-z-]+):/g)].map((found) => found[1]))
    for (const name of names) {
      expect(() => declared(TOKENS, name ?? ""), name).not.toThrow()
    }
    const selectors = new Set(
      [...DENSITY.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}\n]+)\{/g)]
        .map((found) => found[1]?.trim())
        .filter((selector) => !selector?.startsWith("@"))
    )
    expect(selectors).toEqual(new Set(['[data-density="balanced"]', '[data-density="compact"]']))
  })
})

describe("the tight section spacing and the corners' new steps (adr/0067 Ek 2026-11-16)", () => {
  it("scales the section gaps by 0.35: 34 / 22 / 17 px between sections", () => {
    expect(ATOLYE_SECTION_SCALE.tight).toBe("0.35")
    expect(entry.style(chosen({ section_spacing: "tight" }))).toBe(":root{--section-scale:0.35}")
    const gap = (width: number) =>
      Number(/calc\((\d+)px/.exec(tokenAt([TOKENS], "--section-gap", width))?.[1]) * 0.35
    expect([gap(1440), gap(768), gap(390)].map((value) => Math.round(value * 10) / 10)).toEqual([
      33.6, 22.4, 16.8,
    ])
    // The three before it keep their factors
    expect(ATOLYE_SECTION_SCALE).toMatchObject({ compact: "0.55", normal: null, roomy: "1.2" })
  })

  it("prints the corner scale of crisp and gentle, soft still nothing", () => {
    expect(entry.style(chosen({ radius: "crisp" }))).toBe(":root{--radius-scale:0.6}")
    expect(entry.style(chosen({ radius: "gentle" }))).toBe(":root{--radius-scale:0.8}")
    expect(entry.style(chosen({ radius: "soft" }))).toBeNull()
    expect(themeSettings({ radius: "gentle" }, null).radius).toBe("gentle")
    expect(themeSettings({ radius: "rounder" }, null).radius).toBe("soft")
  })
})
