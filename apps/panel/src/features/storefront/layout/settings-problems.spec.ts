import { describe, expect, it } from "vitest"
import type { LayoutSettings } from "@/features/storefront/api/layout"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import { partOf, partProblems, settingsProblems } from "./settings-problems"

const THEME: LayoutSettings["theme"] = { settings_version: 2, theme: "atolye", ...GRAFIT_THEME }
const settings = (colors: Partial<LayoutSettings["theme"]["colors"]>): LayoutSettings => ({
  trust_badges: [],
  color_swatches: [],
  low_stock: { enabled: true, threshold: 3 },
  theme: { ...THEME, colors: { ...THEME.colors, ...colors } },
  menus: null,
})

describe("the theme's colours in the draft (adr/0053 §B, adr/0062 §6, adr/0063 §3)", () => {
  it("takes the theme's own colours and a dark main colour on any page", () => {
    expect(settingsProblems(settings({}), THEME)).toEqual({})
    for (const background of ["steel", "warm", "neutral", "cool"] as const) {
      expect(settingsProblems(settings({ primary: "#0b5c99", background }), THEME)).toEqual({})
    }
  })

  it("refuses a broken code, and a main colour white text or the page cannot carry", () => {
    expect(settingsProblems(settings({ primary: "#0b5c9", accent: "orange" }), THEME)).toEqual({
      "theme.colors.primary": "colorInvalid",
      "theme.colors.accent": "colorInvalid",
    })
    // Over 3:1 on white, under it on the warm page
    expect(settingsProblems(settings({ primary: "#2f8dff", background: "warm" }))).toEqual({
      "theme.colors.primary": "contrast",
    })
    // The accent is not contrast-checked
    expect(settingsProblems(settings({ accent: "#fde68a" }), THEME)).toEqual({})
  })

  it("judges the well only for a colour or page changed from the saved draft's", () => {
    // Reads on Grafit's steel page, not in its well
    const pale = settings({ primary: "#2f8dff" })
    expect(settingsProblems(pale, THEME)).toEqual({ "theme.colors.primary": "wellContrast" })
    // Saved before the rule: kept until either colour changes
    expect(settingsProblems(pale, pale.theme)).toEqual({})
    expect(
      settingsProblems(settings({ primary: "#2f8dff", background: "cool" }), pale.theme)
    ).toEqual({ "theme.colors.primary": "wellContrast" })
    // Not judged without the saved draft (the badges' own check)
    expect(settingsProblems(pale)).toEqual({})
  })

  it("files the theme's problems under its own panel", () => {
    expect(partOf("theme.colors.primary")).toBe("theme")
    const problems = settingsProblems(
      { ...settings({ primary: "#0b5c9" }), color_swatches: [{ label: "", hex: "#000000" }] },
      THEME
    )
    expect(partProblems(problems, "theme")).toEqual({ "theme.colors.primary": "colorInvalid" })
    expect(partProblems(problems, "looks")).toEqual({ "color_swatches.0.label": "required" })
  })
})
