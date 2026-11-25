import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isStaticFile } from "@/lib/seo/paths"
import { DEFAULT_THEME, THEME_FONTS } from "@/lib/views/theme"
import type { ThemeBodyFont, ThemeHeadingFont } from "@qticaret/types"
import { entry } from "@/themes/atolye"
import { ACCENT_FONT_FILES, FONT_FILES, FONT_PRELOAD_BUDGET, fontPreloads } from "../fonts"
import { woff2CodePoints } from "./woff2-cmap"

const publicDir = fileURLToPath(new URL("../../../public", import.meta.url))
const css = readFileSync(fileURLToPath(new URL("../fonts.css", import.meta.url)), "utf8")
const accentFiles = Object.values(ACCENT_FONT_FILES).flat()
const listed = [...Object.values(FONT_FILES).flat(), ...accentFiles]

const HEADINGS: readonly ThemeHeadingFont[] = [
  "fraunces",
  "inter",
  "playfair",
  "dm-serif",
  "manrope",
  "plus-jakarta",
  "montserrat",
]
const BODIES: readonly ThemeBodyFont[] = [
  "inter",
  "manrope",
  "source-sans",
  "nunito",
  "plus-jakarta",
  "montserrat",
]
/** The heading faces whose files carry no ₺ (the panel says so, `NO_LIRA_FONTS`). */
const NO_LIRA: readonly string[] = ["playfair", "dm-serif"]
const codePoints = (path: string) => woff2CodePoints(readFileSync(`${publicDir}${path}`))
const chars = (text: string) => Array.from(text, (char) => char.codePointAt(0) ?? 0)
const bytes = (paths: readonly string[]) =>
  paths.reduce((sum, path) => sum + statSync(`${publicDir}${path}`).size, 0)

describe("the self-hosted faces", () => {
  it("lists exactly the files under public/fonts, each named by its content's hash", () => {
    const onDisk = readdirSync(`${publicDir}/fonts`).filter((name) => name.endsWith(".woff2"))
    expect(onDisk.map((name) => `/fonts/${name}`).sort()).toEqual([...listed].sort())
    for (const path of listed) {
      const hash = createHash("sha256")
        .update(readFileSync(`${publicDir}${path}`))
        .digest("hex")
        .slice(0, 10)
      expect(path).toContain(`.${hash}.woff2`)
    }
  })

  it("declares every listed file once in fonts.css, and every face's variable", () => {
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1])
    expect([...urls].sort()).toEqual([...listed].sort())
    for (const { variable } of Object.values(THEME_FONTS)) {
      expect(css).toContain(`${variable}: "qt-`)
    }
    // The first look's own faces went with it (adr/0062 §7)
    expect(css).not.toMatch(/caslon|hanken/)
  })

  it("draws every Turkish letter in the face itself: ç ö ü ı from latin, ğ İ ş from its cut", () => {
    for (const [font, [latin, turkish]] of Object.entries(FONT_FILES)) {
      const own = codePoints(latin)
      const cut = codePoints(turkish)
      for (const point of chars("çÇöÖüÜıa")) expect(own.has(point), `${font} ${latin}`).toBe(true)
      for (const point of chars("ğĞİşŞ")) expect(cut.has(point), `${font} ${turkish}`).toBe(true)
      expect(cut.has(0x20ba), `${font} ₺`).toBe(!NO_LIRA.includes(font))
    }
  })

  it("serves every file past the proxy (no resolve, no 404 report)", () => {
    for (const path of listed) {
      expect(isStaticFile(path)).toBe(true)
    }
  })
})

describe("fontPreloads", () => {
  it("preloads the shop's body face, then its heading face, and nothing else", () => {
    // Grafit draws both with Manrope (adr/0062 §2): one face, named once
    expect(fontPreloads(DEFAULT_THEME)).toEqual([...FONT_FILES.manrope])
    expect(
      fontPreloads({ ...DEFAULT_THEME, typography: { heading: "fraunces", body: "inter" } })
    ).toEqual([...FONT_FILES.inter, ...FONT_FILES.fraunces])
  })

  it("follows the shop's choice (theme.typography)", () => {
    const chosen = fontPreloads({
      ...DEFAULT_THEME,
      typography: { heading: "playfair", body: "nunito" },
    })
    expect(chosen).toEqual([...FONT_FILES.nunito, ...FONT_FILES.playfair])
    expect(chosen.some((path) => path.includes("inter") || path.includes("fraunces"))).toBe(false)
  })

  it("preloads the 2026-11-25 faces only for the shop that chose them", () => {
    const chosen = fontPreloads({
      ...DEFAULT_THEME,
      typography: { heading: "montserrat", body: "plus-jakarta" },
    })
    expect(chosen).toEqual([...FONT_FILES["plus-jakarta"], ...FONT_FILES.montserrat])
    expect(fontPreloads(DEFAULT_THEME).some((path) => /jakarta|montserrat/.test(path))).toBe(false)
  })

  it("names a face once when it draws both", () => {
    expect(
      fontPreloads({ ...DEFAULT_THEME, typography: { heading: "manrope", body: "manrope" } })
    ).toEqual([...FONT_FILES.manrope])
    expect(
      fontPreloads({ ...DEFAULT_THEME, typography: { heading: "inter", body: "inter" } })
    ).toEqual([...FONT_FILES.inter])
  })

  it("keeps every pair the shop may choose within the preload budget (docs/21, adr/0062 §7)", () => {
    expect(FONT_PRELOAD_BUDGET).toBe(125_000)
    const totals = HEADINGS.flatMap((heading) =>
      BODIES.map((body) => {
        const files = fontPreloads({ ...DEFAULT_THEME, typography: { heading, body } })
        // Body first, then the heading face; two files a face, none twice
        expect(files.slice(0, 2)).toEqual([...FONT_FILES[body]])
        expect(files).toHaveLength(heading === body ? 2 : 4)
        expect(new Set(files).size).toBe(files.length)
        return { pair: `${heading} + ${body}`, total: bytes(files) }
      })
    )
    expect(totals).toHaveLength(HEADINGS.length * BODIES.length)
    for (const { pair, total } of totals) {
      expect(total, pair).toBeLessThanOrEqual(FONT_PRELOAD_BUDGET)
    }
    // The heaviest pair and Grafit's own, as measured (a changed file is a new measure)
    expect(totals.find(({ pair }) => pair === "fraunces + inter")?.total).toBe(124_968)
    expect(bytes(fontPreloads(DEFAULT_THEME))).toBe(26_932)
    expect(Math.max(...totals.map(({ total }) => total))).toBe(124_968)
  })

  it("is what the Atölye theme preloads: the chosen pair, Manrope at the defaults", () => {
    expect(entry.fontPreloads(DEFAULT_THEME)).toEqual([...FONT_FILES.manrope])
    expect(
      entry.fontPreloads({ ...DEFAULT_THEME, typography: { heading: "dm-serif", body: "nunito" } })
    ).toEqual([...FONT_FILES.nunito, ...FONT_FILES["dm-serif"]])
  })
})
