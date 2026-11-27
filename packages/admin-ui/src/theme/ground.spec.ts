import { converter } from "culori"
import { DEFAULT_APPEARANCE, THEME_PRESETS, THEME_SIDEBARS, THEME_SURFACES } from "@qticaret/types"
import type { AppearanceSettings, ThemeSurface } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import { AA_LARGE, AA_TEXT, contrast, resolveTheme } from "./engine"
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
const MODES: ResolvedMode[] = ["light", "dark"]
const look = (brand: string, surface: ThemeSurface): AppearanceSettings => ({
  ...DEFAULT_APPEARANCE,
  brand_color: brand,
  surface,
})

// Text on every surface the ground draws (docs/18 §8: AA, by the engine)
const PAIRS: [Var, Var][] = [
  ["--foreground", "--background"],
  ["--muted-foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--muted-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--secondary-foreground", "--secondary"],
  ["--muted-foreground", "--muted"],
  ["--accent-foreground", "--accent"],
  ["--primary-text", "--background"],
  ["--primary-text", "--card"],
  ["--primary-text", "--muted"],
  ["--primary-foreground", "--primary"],
]
const SIDEBAR_PAIRS: [Var, Var][] = [
  ["--sidebar-foreground", "--sidebar"],
  ["--sidebar-muted-foreground", "--sidebar"],
  ["--sidebar-accent-foreground", "--sidebar-accent"],
  ["--sidebar-primary-foreground", "--sidebar-primary"],
]

describe("the surfaces' tone (Zemin rengi)", () => {
  it.each(MODES)("keeps every text pair at AA for every tone and preset in %s mode", (mode) => {
    for (const surface of THEME_SURFACES) {
      for (const preset of THEME_PRESETS) {
        for (const sidebar of THEME_SIDEBARS) {
          const { vars } = resolveTheme({ ...look(preset.brand_color, surface), sidebar }, mode)
          for (const [fg, bg] of [...PAIRS, ...SIDEBAR_PAIRS]) {
            const ok = contrast(color(vars, fg), color(vars, bg)) >= AA_TEXT
            expect({ surface, preset: preset.key, sidebar, fg, bg, ok }).toEqual({
              surface,
              preset: preset.key,
              sidebar,
              fg,
              bg,
              ok: true,
            })
          }
          expect(
            contrast(color(vars, "--sidebar-primary"), color(vars, "--sidebar"))
          ).toBeGreaterThanOrEqual(AA_LARGE)
        }
      }
    }
  })

  it("reads a look saved before the choice as the brand-tinted one", () => {
    const before: Partial<AppearanceSettings> = look("#b42318", "brand")
    delete before.surface
    for (const mode of MODES) {
      expect(resolveTheme(before as AppearanceSettings, mode).vars).toEqual(
        resolveTheme(look("#b42318", "brand"), mode).vars
      )
    }
  })

  it.each(MODES)("draws plain grey surfaces when neutral is chosen in %s mode", (mode) => {
    const { vars } = resolveTheme({ ...look("#b42318", "neutral"), sidebar: "dark" }, mode)
    for (const name of ["--background", "--card", "--muted", "--border", "--accent", "--sidebar"]) {
      expect({ name, c: color(vars, name as Var).c }).toEqual({ name, c: 0 })
    }
    // The brand stays on the button
    expect(color(vars, "--primary").c).toBeGreaterThan(0.1)
  })

  it.each(["warm", "cool"] as const)("keeps the %s grey whatever the brand colour", (surface) => {
    const red = resolveTheme(look("#b42318", surface), "light").vars
    const blue = resolveTheme(look("#2f6feb", surface), "light").vars
    for (const name of ["--background", "--card", "--border", "--accent", "--sidebar"]) {
      expect({ name, value: red[name as Var] }).toEqual({ name, value: blue[name as Var] })
    }
    expect(red["--primary"]).not.toBe(blue["--primary"])
  })

  it("tints the hover ground less than the brand tone does for a strong colour", () => {
    for (const mode of MODES) {
      const brand = color(resolveTheme(look("#b42318", "brand"), mode).vars, "--accent").c
      for (const surface of ["neutral", "warm", "cool"] as const) {
        const other = color(resolveTheme(look("#b42318", surface), mode).vars, "--accent").c
        expect(other).toBeLessThan(brand)
      }
    }
  })
})
