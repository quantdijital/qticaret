import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { DEFAULT_THEME, themeStyle } from "@/lib/views/theme"
import { atolyeSettings } from "../atolye"
import {
  DEFAULT_STOREFRONT_THEME,
  STOREFRONT_THEMES,
  storefrontThemeName,
  themeEntries,
} from "../choice"

describe("the theme a build is made with (adr/0057)", () => {
  it("is Atölye when STOREFRONT_THEME is unset or empty", () => {
    expect(DEFAULT_STOREFRONT_THEME).toBe("atolye")
    expect(storefrontThemeName(undefined)).toBe("atolye")
    expect(storefrontThemeName("")).toBe("atolye")
    expect(storefrontThemeName("  ")).toBe("atolye")
  })

  it("takes every installed theme by its name", () => {
    for (const name of STOREFRONT_THEMES) {
      expect(storefrontThemeName(` ${name} `)).toBe(name)
    }
  })

  it("stops the build on an unknown name, naming the ones it knows", () => {
    expect(() => storefrontThemeName("atolya")).toThrow(/one of atolye \(got "atolya"\)/)
    expect(() => storefrontThemeName("../atolye")).toThrow()
    // The removed first theme (adr/0057 Ek 2026-11-09) is an unknown name now
    expect(() => storefrontThemeName("base")).toThrow(/"base"/)
  })

  it("points every alias at the theme's own entry", () => {
    expect(themeEntries("atolye")).toEqual({
      pages: "./src/themes/atolye.ts",
      styles: "./src/themes/atolye.css",
      error: "./src/themes/atolye-error.ts",
    })
  })

  it("has every entry for every installed theme", () => {
    const here = dirname(fileURLToPath(import.meta.url))
    for (const name of STOREFRONT_THEMES) {
      for (const entry of Object.values(themeEntries(name))) {
        expect(existsSync(join(here, "..", "..", "..", entry))).toBe(true)
      }
    }
  })
})

describe("the settings the Atölye theme takes", () => {
  const chosen = {
    ...DEFAULT_THEME,
    colors: { primary: "#7a1a48", accent: "#ffcc00", background: "cool" as const },
    typography: { heading: "playfair" as const, body: "nunito" as const },
    radius: "round" as const,
    buttons: "square" as const,
    product_card: { ...DEFAULT_THEME.product_card, ratio: "1:1" as const },
  }

  it("prints the shop's main colour and the cards' shape, nothing of faces, corners or page colour", () => {
    const style = themeStyle(atolyeSettings(chosen)) ?? ""

    expect(style).toContain("--primary:#7a1a48")
    expect(style).toContain("--card-ratio:1 / 1")
    for (const taken of [
      "--font-",
      "--radius-scale",
      "--button-radius",
      "--background",
      "--highlight",
    ]) {
      expect(style).not.toContain(taken)
    }
  })

  it("prints nothing at the defaults", () => {
    expect(themeStyle(atolyeSettings(DEFAULT_THEME))).toBeNull()
  })
})
