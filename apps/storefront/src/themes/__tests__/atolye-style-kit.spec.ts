import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import { DEFAULT_THEME, themeSettings, themeView } from "@/lib/views/theme"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { entry } from "../atolye"

/**
 * The style kit's contract (adr/0067 §1, §3b, "Uygulama notu"): the four
 * fields read from the answer, a step off the default marked on the
 * theme's root element as `data-*`, nothing at the defaults. No drawing
 * yet: each field's CSS comes with its own step of the ADR.
 */

const chosen = (patch: Partial<StoreThemeSettings>): StoreThemeSettings => ({
  ...DEFAULT_THEME,
  ...patch,
})

const OFF_DEFAULT = {
  menu_style: "plain",
  shadow: "none",
  chip_style: "lined",
  media_ground: "page",
} as const

/** The frame's root element: the first tag the theme's Layout prints. */
const rootTag = (settings: StoreThemeSettings, checkout = false): string => {
  const html = renderFrame(atolyeTheme, shopFixture({ theme: themeView(settings), checkout }))
  return /^<div[^>]*>/.exec(html)?.[0] ?? ""
}

describe("the style kit in the storefront (adr/0067)", () => {
  it("reads each field from the answer, a missing or off-list step as today's drawing", () => {
    expect(themeSettings(OFF_DEFAULT, null)).toMatchObject(OFF_DEFAULT)
    expect(themeSettings({ menu_style: "underline" }, null)).toMatchObject({
      menu_style: "underline",
      shadow: "float",
      chip_style: "filled",
      media_ground: "well",
    })
    const odd = themeSettings(
      { menu_style: "boxed", shadow: "0 0 4px red", chip_style: 1, media_ground: null },
      null
    )
    expect(odd).toMatchObject({
      menu_style: "filled",
      shadow: "float",
      chip_style: "filled",
      media_ground: "well",
    })
  })

  it("marks nothing on the frame at the defaults: the page prints what it did before the kit", () => {
    const tag = rootTag(DEFAULT_THEME)
    expect(tag).toBe('<div class="flex min-h-dvh flex-col" data-surface="filled">')
    expect(rootTag(DEFAULT_THEME, true)).toBe(tag)
  })

  it("marks a step off the default on the frame's root element, that one only", () => {
    expect(rootTag(chosen({ menu_style: "plain" }))).toBe(
      '<div class="flex min-h-dvh flex-col" data-surface="filled" data-menu-style="plain">'
    )
    expect(rootTag(chosen({ menu_style: "underline" }))).toContain('data-menu-style="underline"')
    const all = rootTag(chosen(OFF_DEFAULT))
    for (const mark of [
      'data-menu-style="plain"',
      'data-shadow="none"',
      'data-chip-style="lined"',
      'data-media-ground="page"',
    ]) {
      expect(all).toContain(mark)
    }
    // The checkout's focused frame carries them too
    expect(rootTag(chosen({ shadow: "none" }), true)).toContain('data-shadow="none"')
  })

  it("prints no CSS for the kit: its marks are attributes, its drawing the theme's stylesheet", () => {
    expect(entry.style(chosen(OFF_DEFAULT))).toBeNull()
    expect(entry.style(chosen({ ...OFF_DEFAULT, section_spacing: "compact" }))).toBe(
      ":root{--section-scale:0.55}"
    )
  })
})
