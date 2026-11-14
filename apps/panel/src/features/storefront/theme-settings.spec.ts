import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  GRAFIT_THEME,
  HEADING_FONTS,
  BODY_FONTS,
  NO_LIRA_FONTS,
  SINGLE_WEIGHT_FONTS,
} from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import {
  CONTRAST_ERROR,
  GRAFIT_VALUES,
  isContrastRefusal,
  isGrafit,
  themeBodyOf,
  themeSchema,
  themeValuesOf,
} from "./theme-settings"

const SAVED: ThemeSettings = {
  settings_version: 2,
  theme: "atolye",
  colors: { primary: null, accent: "#C2410C", background: "warm" },
  typography: { heading: "fraunces", body: "inter" },
  radius: "soft",
  product_card: { ratio: "4:5", show_brand: true, show_rating: false },
  header: { layout: "centered", sticky: true },
  buttons: "pill",
}

describe("the theme settings form (adr/0053 §B)", () => {
  it("shows the storefront's old main colour until one is saved here, then sends it", () => {
    const values = themeValuesOf(SAVED, "#0b5c99")
    expect(values.colors).toEqual({ primary: "#0b5c99", accent: "#C2410C", background: "warm" })
    expect(
      themeValuesOf({ ...SAVED, colors: { ...SAVED.colors, primary: "#111113" } }, "#0b5c99")
    ).toMatchObject({ colors: { primary: "#111113" } })

    const body = themeBodyOf(themeSchema.parse({ ...values, colors: { ...values.colors } }))
    // Lower case as the server keeps it; the theme itself and the settings' version are not sent
    expect(body).toEqual({
      colors: { primary: "#0b5c99", accent: "#c2410c", background: "warm" },
      typography: { heading: "fraunces", body: "inter" },
      radius: "soft",
      product_card: { ratio: "4:5", show_brand: true, show_rating: false },
      header: { layout: "centered", sticky: true },
      buttons: "pill",
    })
  })

  it("sends an empty colour as none: the theme's own", () => {
    const values = themeValuesOf(SAVED, null)
    const body = themeBodyOf(
      themeSchema.parse({ ...values, colors: { ...values.colors, accent: "" } })
    )
    expect(body.colors).toEqual({ primary: null, accent: null, background: "warm" })
  })

  it("refuses a main colour that does not read on the chosen page, and a broken code", () => {
    const values = themeValuesOf(SAVED, null)
    const on = (primary: string, background: ThemeSettings["colors"]["background"]) =>
      themeSchema.safeParse({ ...values, colors: { ...values.colors, primary, background } })

    const warm = on("#2f8dff", "warm")
    expect(warm.success).toBe(false)
    expect(warm.error?.issues[0]).toMatchObject({
      path: ["colors", "primary"],
      message: CONTRAST_ERROR,
    })
    expect(on("#2f8dff", "neutral").success).toBe(true)
    // Grafit's steel is the lightest page: it takes the colour too
    expect(on("#2f8dff", "steel").success).toBe(true)
    expect(on("#0b5c9", "warm").success).toBe(false)
    expect(themeSchema.safeParse({ ...values, radius: "pointy" }).success).toBe(false)
  })

  it("knows the server's contrast refusal by its key", () => {
    expect(isContrastRefusal({ status: 400, code: "platform_settings.color_contrast" })).toBe(true)
    expect(isContrastRefusal({ status: 400, message: "platform_settings.color_contrast" })).toBe(
      true
    )
    expect(isContrastRefusal({ status: 400, message: "Renk #rrggbb biçiminde olmalı." })).toBe(
      false
    )
    expect(isContrastRefusal(null)).toBe(false)
  })
})

describe("Grafit, the theme's defaults (adr/0062 §2)", () => {
  it("is today's look: the backend's defaults and the storefront's, in the panel's one copy", () => {
    expect(GRAFIT_THEME).toEqual({
      colors: { primary: null, accent: null, background: "steel" },
      typography: { heading: "manrope", body: "manrope" },
      radius: "soft",
      product_card: { ratio: "1:1", show_brand: true, show_rating: false },
      header: { layout: "left", sticky: true },
      buttons: "pill",
    })
    // As the form holds it, and sent back unchanged
    expect(GRAFIT_VALUES.colors).toEqual({ primary: "", accent: "", background: "steel" })
    expect(themeBodyOf(themeSchema.parse(GRAFIT_VALUES))).toEqual(GRAFIT_THEME)
  })

  it("knows a form that holds Grafit from one a single choice away", () => {
    expect(isGrafit(GRAFIT_VALUES)).toBe(true)
    // The storefront's old main colour shows in the form: not Grafit until it is cleared
    expect(isGrafit(themeValuesOf({ ...SAVED, ...GRAFIT_THEME }, "#0b5c99"))).toBe(false)
    const g = GRAFIT_VALUES
    const away: (typeof GRAFIT_VALUES)[] = [
      { ...g, colors: { ...g.colors, primary: "#0b5c99" } },
      { ...g, colors: { ...g.colors, accent: "#c2410c" } },
      { ...g, colors: { ...g.colors, background: "warm" } },
      { ...g, typography: { ...g.typography, heading: "fraunces" } },
      { ...g, typography: { ...g.typography, body: "inter" } },
      { ...g, radius: "sharp" },
      { ...g, buttons: "square" },
      { ...g, product_card: { ...g.product_card, ratio: "4:5" } },
      { ...g, product_card: { ...g.product_card, show_brand: false } },
      { ...g, product_card: { ...g.product_card, show_rating: true } },
      { ...g, header: { ...g.header, layout: "centered" } },
      { ...g, header: { ...g.header, sticky: false } },
    ]
    expect(away.map(isGrafit)).toEqual(away.map(() => false))
  })
})

describe("what the form says about a heading face (adr/0062 §7)", () => {
  // Tests run from the package; the faces' files are the storefront's
  const css = readFileSync(
    join(process.cwd(), "..", "storefront", "src", "app", "fonts.css"),
    "utf8"
  )
  /** The `@font-face` blocks the storefront declares for a face. */
  const blocks = (font: string) =>
    css.split("@font-face").filter((block) => block.includes(`font-family: "qt-${font}";`))

  it("warns of no ₺ for exactly the faces whose files carry none", () => {
    const without = [...new Set([...HEADING_FONTS, ...BODY_FONTS])].filter(
      (font) => !blocks(font).some((block) => /unicode-range:[^;]*U\+20BA/i.test(block))
    )
    expect(without.sort()).toEqual([...NO_LIRA_FONTS].sort())
    // Prices are drawn in the body face: every body face must carry the sign
    expect(BODY_FONTS.filter((font) => (NO_LIRA_FONTS as ReadonlySet<string>).has(font))).toEqual(
      []
    )
  })

  it("warns of one weight for exactly the faces declared with a single weight", () => {
    const single = HEADING_FONTS.filter((font) => {
      const weights = blocks(font).map((block) => /font-weight:\s*([^;]+);/.exec(block)?.[1])
      expect(weights.length, font).toBeGreaterThan(0)
      // A variable face declares a range ("200 800"), a static one a single number
      return weights.every((weight) => /^\d+$/.test(weight?.trim() ?? ""))
    })
    expect([...single].sort()).toEqual([...SINGLE_WEIGHT_FONTS].sort())
  })
})
