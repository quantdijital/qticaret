import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
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
