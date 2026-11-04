import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isStaticFile } from "@/lib/seo/paths"
import { DEFAULT_THEME, THEME_FONTS } from "@/lib/views/theme"
import { FONT_FILES, THEME_OWN_FONT_FILES, fontPreloads } from "../fonts"

const publicDir = fileURLToPath(new URL("../../../public", import.meta.url))
const css = readFileSync(fileURLToPath(new URL("../fonts.css", import.meta.url)), "utf8")
const listed = [...Object.values(FONT_FILES), ...Object.values(THEME_OWN_FONT_FILES)].flat()

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
    // A theme's own faces (adr/0057): the Atölye theme's tokens read these
    expect(css).toContain('--font-caslon: "qt-caslon"')
    expect(css).toContain('--font-hanken: "qt-hanken"')
  })

  it("serves every file past the proxy (no resolve, no 404 report)", () => {
    for (const path of listed) {
      expect(isStaticFile(path)).toBe(true)
    }
  })
})

describe("fontPreloads", () => {
  it("preloads the shop's body face, then its heading face, and nothing else", () => {
    expect(fontPreloads(DEFAULT_THEME)).toEqual([...FONT_FILES.inter, ...FONT_FILES.fraunces])
  })

  it("follows the shop's choice (theme.typography)", () => {
    const chosen = fontPreloads({
      ...DEFAULT_THEME,
      typography: { heading: "playfair", body: "nunito" },
    })
    expect(chosen).toEqual([...FONT_FILES.nunito, ...FONT_FILES.playfair])
    expect(chosen.some((path) => path.includes("inter") || path.includes("fraunces"))).toBe(false)
  })

  it("names a face once when it draws both", () => {
    expect(
      fontPreloads({ ...DEFAULT_THEME, typography: { heading: "manrope", body: "manrope" } })
    ).toEqual([...FONT_FILES.manrope])
  })
})
