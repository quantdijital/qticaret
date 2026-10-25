import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { converter } from "culori"
import { DEFAULT_APPEARANCE, THEME_PRESETS, THEME_SIDEBARS } from "@qticaret/types"
import type { AppearanceSettings } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import { AA_LARGE, AA_TEXT, contrast, parseBrandColor, resolveTheme } from "./engine"
import type { ResolvedMode, ThemeVariables } from "./engine"

type Var = `--${string}`

const toOklch = converter("oklch")
const color = (vars: ThemeVariables, name: Var) => {
  const parsed = toOklch(vars[name])
  if (!parsed) {
    throw new Error(`${name} is not a colour: ${String(vars[name])}`)
  }
  return parsed
}
const settings = (brand: string): AppearanceSettings => ({
  ...DEFAULT_APPEARANCE,
  brand_color: brand,
})
const MODES: ResolvedMode[] = ["light", "dark"]

// Text pairs every screen relies on (docs/18 §8: AA, by the engine)
const BASE_TEXT_PAIRS: [Var, Var][] = [
  ["--foreground", "--background"],
  ["--muted-foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--primary-foreground", "--primary"],
  ["--accent-foreground", "--accent"],
  ["--destructive-foreground", "--destructive"],
  ["--success-foreground", "--success"],
  ["--warning-foreground", "--warning"],
  ["--info-foreground", "--info"],
]

// Status labels on their tint and on cards
const STATUS_TEXT_PAIRS: [Var, Var][] = ["success", "warning", "destructive", "info"].flatMap(
  (name): [Var, Var][] => [
    [`--${name}-text`, `--${name}-soft`],
    [`--${name}-text`, "--card"],
  ]
)

// The navigation's text, for every sidebar style
const SIDEBAR_TEXT_PAIRS: [Var, Var][] = [
  ["--sidebar-foreground", "--sidebar"],
  ["--sidebar-muted-foreground", "--sidebar"],
  ["--sidebar-accent-foreground", "--sidebar-accent"],
  ["--sidebar-primary-foreground", "--sidebar-primary"],
]

const TEXT_PAIRS: [Var, Var][] = [...BASE_TEXT_PAIRS, ...STATUS_TEXT_PAIRS]

describe("resolveTheme", () => {
  it.each(MODES)("keeps the navigation readable in every sidebar style in %s mode", (mode) => {
    for (const preset of THEME_PRESETS) {
      for (const sidebar of THEME_SIDEBARS) {
        const { vars } = resolveTheme({ ...settings(preset.brand_color), sidebar }, mode)
        for (const [fg, bg] of SIDEBAR_TEXT_PAIRS) {
          const ratio = contrast(color(vars, fg), color(vars, bg))
          expect({ preset: preset.key, sidebar, fg, ok: ratio >= AA_TEXT }).toEqual({
            preset: preset.key,
            sidebar,
            fg,
            ok: true,
          })
        }
        // The active item's marker stands out from the navigation
        expect(
          contrast(color(vars, "--sidebar-primary"), color(vars, "--sidebar"))
        ).toBeGreaterThanOrEqual(AA_LARGE)
      }
    }
  })

  it.each(MODES)("keeps the brand series and ordered ramp visible on cards in %s mode", (mode) => {
    for (const preset of THEME_PRESETS) {
      const { vars } = resolveTheme(settings(preset.brand_color), mode)
      expect(contrast(color(vars, "--chart-1"), color(vars, "--card"))).toBeGreaterThanOrEqual(
        AA_LARGE
      )
      // dataviz: the ordinal step nearest the surface clears 2:1
      for (const step of [1, 2, 3, 4]) {
        expect(
          contrast(color(vars, `--chart-ramp-${String(step)}`), color(vars, "--card"))
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it.each(MODES)("keeps every text pair at AA in %s mode for every preset", (mode) => {
    for (const preset of THEME_PRESETS) {
      const { vars } = resolveTheme(settings(preset.brand_color), mode)
      for (const [fg, bg] of TEXT_PAIRS) {
        const ratio = contrast(color(vars, fg), color(vars, bg))
        expect({ preset: preset.key, fg, bg, ok: ratio >= AA_TEXT }).toEqual({
          preset: preset.key,
          fg,
          bg,
          ok: true,
        })
      }
    }
  })

  it.each(MODES)("keeps the primary fill apart from the page in %s mode", (mode) => {
    for (const preset of THEME_PRESETS) {
      const { vars } = resolveTheme(settings(preset.brand_color), mode)
      expect(
        contrast(color(vars, "--primary"), color(vars, "--background"))
      ).toBeGreaterThanOrEqual(AA_LARGE)
    }
  })

  it("moves a brand colour that text could not sit on, and says so", () => {
    const yellow = resolveTheme(settings("#ffff00"), "light")
    const black = resolveTheme(settings("#000000"), "light")

    expect(yellow.brandAdjusted).toBe(true)
    expect(black.brandAdjusted).toBe(true)
    expect(
      contrast(color(yellow.vars, "--primary-foreground"), color(yellow.vars, "--primary"))
    ).toBeGreaterThanOrEqual(AA_TEXT)
    expect(resolveTheme(settings(DEFAULT_APPEARANCE.brand_color), "light").brandAdjusted).toBe(
      false
    )
  })

  it("tints the neutrals with the brand hue, faintly", () => {
    const { vars } = resolveTheme(settings("#b42318"), "light")
    const background = color(vars, "--background")

    expect(background.c).toBeGreaterThan(0)
    expect(background.c).toBeLessThan(0.01)
    expect(Math.abs((background.h ?? 0) - parseBrandColor("#b42318").h)).toBeLessThan(1)
  })

  it("maps radius and density to pixel tokens", () => {
    const { vars } = resolveTheme(
      { ...DEFAULT_APPEARANCE, radius: "round", density: "compact" },
      "light"
    )

    expect(vars["--radius"]).toBe("12px")
    expect(vars["--control-height"]).toBe("32px")
    expect(vars["--row-height"]).toBe("38px")
  })

  it("gives five distinct chart colours", () => {
    const { vars } = resolveTheme(DEFAULT_APPEARANCE, "light")
    const charts = [1, 2, 3, 4, 5].map((index) => vars[`--chart-${String(index)}`])

    expect(new Set(charts).size).toBe(5)
  })

  it("refuses a value that is not a colour", () => {
    expect(() => resolveTheme(settings("blue-ish"), "light")).toThrow(RangeError)
  })

  it("emits only tokens that tokens.css declares as defaults", () => {
    // Vitest runs from the package root; a `?raw` import is emptied by `css: false`
    const tokensCss = readFileSync(resolve(process.cwd(), "src/theme/tokens.css"), "utf8")
    const declared = new Set([...tokensCss.matchAll(/(--[\w-]+):/g)].map((match) => match[1]))
    for (const mode of MODES) {
      for (const name of Object.keys(resolveTheme(DEFAULT_APPEARANCE, mode).vars)) {
        expect({ name, declared: declared.has(name) }).toEqual({ name, declared: true })
      }
    }
  })
})
