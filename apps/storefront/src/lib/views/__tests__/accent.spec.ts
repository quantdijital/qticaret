import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { ACCENT_FONTS } from "@qticaret/types/hand-note"
import { ACCENT_FONT_FILES, fontPreloads } from "@/app/fonts"
import { ACCENT_FONT_VARIABLES, handFace, handNoteView } from "../accent"
import { DEFAULT_THEME, themeSettings, themeStyle } from "../theme"

const css = readFileSync(fileURLToPath(new URL("../../../app/fonts.css", import.meta.url)), "utf8")

const withAccent = (accent: unknown) =>
  themeSettings({ typography: { heading: "manrope", body: "manrope", accent } }, null)

describe("the theme's accent face (typography.accent)", () => {
  it("reads none, nothing or a face off the list as the defaults, unchanged", () => {
    for (const accent of [undefined, null, "none", "comic-sans", "url(https://x/y.woff2)"]) {
      const settings = withAccent(accent)
      expect(settings).toEqual(DEFAULT_THEME)
      expect(settings.typography).not.toHaveProperty("accent")
      expect(themeStyle(settings)).toBeNull()
      expect(handFace(settings)).toBe(false)
    }
  })

  it("prints the chosen face's variable as --font-accent, and only that", () => {
    expect(themeStyle(withAccent("caveat"))).toBe(
      ":root{--font-accent:var(--font-caveat), cursive}"
    )
    expect(themeStyle(withAccent("dancing-script"))).toBe(
      ":root{--font-accent:var(--font-dancing-script), cursive}"
    )
    expect(handFace(withAccent("kalam"))).toBe(true)
  })

  it("has a variable and two self-hosted files for every face on the contract's list", () => {
    const faces = ACCENT_FONTS.filter((font) => font !== "none")
    expect(Object.keys(ACCENT_FONT_VARIABLES).sort()).toEqual([...faces].sort())
    expect(Object.keys(ACCENT_FONT_FILES).sort()).toEqual([...faces].sort())
    for (const face of faces) {
      expect(css).toContain(`${ACCENT_FONT_VARIABLES[face]}: "qt-${face}", "qt-${face}-fallback";`)
      for (const file of ACCENT_FONT_FILES[face]) {
        expect(css).toContain(`url("${file}")`)
        expect(file).toMatch(/^\/fonts\/[a-z-]+\.[0-9a-f]{10}\.woff2$/)
      }
    }
  })

  it("is never preloaded: a page fetches it only when a note is drawn in it", () => {
    const accentFiles = Object.values(ACCENT_FONT_FILES).flat()
    for (const accent of ACCENT_FONTS) {
      const preloads = fontPreloads(withAccent(accent))
      expect(preloads.filter((file) => accentFiles.includes(file))).toEqual([])
    }
    // No rule of the faces' sheet draws text in an accent face by itself: only variables name them
    for (const face of Object.keys(ACCENT_FONT_FILES)) {
      const uses = [...css.matchAll(new RegExp(`"qt-${face}"`, "g"))].length
      // Two @font-face declarations and the variable
      expect(uses, face).toBe(3)
    }
  })
})

describe("handNoteView", () => {
  it("is the trimmed words with the face, none for nothing", () => {
    expect(handNoteView("  Sizi bekliyoruz! ", true)).toEqual({
      text: "Sizi bekliyoruz!",
      hand: true,
    })
    expect(handNoteView("Merhaba", false)).toEqual({ text: "Merhaba", hand: false })
    for (const note of [undefined, null, "", "   "]) {
      expect(handNoteView(note, true)).toBeNull()
    }
  })
})
