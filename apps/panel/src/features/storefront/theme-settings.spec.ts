import { describe, expect, it } from "vitest"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import {
  CONTRAST_ERROR,
  isContrastRefusal,
  themeBodyOf,
  themeSchema,
  themeValuesOf,
} from "./theme-settings"

const SAVED: ThemeSettings = {
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
    // Lower case as the server keeps it; the theme itself is not sent
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
