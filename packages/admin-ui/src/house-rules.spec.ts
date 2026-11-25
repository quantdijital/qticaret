import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import en from "./locales/en.json" with { type: "json" }
import tr from "./locales/tr.json" with { type: "json" }

/**
 * Docs/18 §9 for the shared code, as the panel's own test holds it for the
 * panel (apps/panel `src/theme/house-rules.spec.ts`): colours, corners and
 * shadows come from the theme's tokens, and every text is in both
 * languages, Turkish without exclamation marks. A rule broken on purpose is
 * listed with its reason.
 */

// Tests run from the package
const SRC = join(process.cwd(), "src")

function sources(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return sources(path)
    }
    return /\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : []
  })
}

const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide)-(?:red|green|blue|yellow|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)(?:-\d{2,3})?\b/g
const HEX = /#[0-9a-fA-F]{6}\b/g
const PX_CORNER = /\brounded(?:-[a-z]+)?-\[\d+px\]/g

// Colours that are not the theme's on purpose
const ALLOWED: Record<string, string> = {
  // The dimmed page behind a dialog
  "ui/alert-dialog.tsx bg-black": "overlay",
  "ui/dialog.tsx bg-black": "overlay",
  "ui/sheet.tsx bg-black": "overlay",
}

function breaches(pattern: RegExp, skip: (path: string) => boolean = () => false): string[] {
  return sources().flatMap((path) => {
    const file = relative(SRC, path)
    if (skip(file)) {
      return []
    }
    const text = readFileSync(path, "utf8")
    return [...new Set(text.match(pattern) ?? [])]
      .map((found) => `${file} ${found}`)
      .filter((entry) => !(entry in ALLOWED))
  })
}

interface Tree {
  [key: string]: string | Tree
}

function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === "string" ? [[path, value] as [string, string]] : leaves(value, path)
  })
}

describe("the shared admin UI's house rules (docs/18 §9)", () => {
  it("takes colours and corners from the theme", () => {
    expect(breaches(PALETTE)).toEqual([])
    // The theme engine and its charts define the colours
    expect(breaches(HEX, (file) => file.startsWith("theme/"))).toEqual([])
    expect(breaches(PX_CORNER)).toEqual([])
  })

  it("types numbers in its own field, never the browser's spinner", () => {
    // The owner, 2026-11-03: "artır azalt ikonları default ikonlar olarak geliyor"
    const own = (file: string) => file === "patterns/number-field.tsx" || file.startsWith("charts/")
    expect(breaches(/<Input\b[^>]*\btype="number"/g, own)).toEqual([])
    expect(breaches(/<input\b[^>]*\btype="number"/g, own)).toEqual([])
  })

  it("draws a sheet only as a phone's menu", () => {
    // The owner, 2026-11-06: a record opens in the standard dialog (the apps hold the same rule).
    // Menus are not records: the sidebar on a phone, and a list's filter menu from the bottom
    // edge on a phone or a touch screen (the owner, 2026-11-25)
    const menus = new Set(["ui/sidebar.tsx", "patterns/filter-bar.tsx"])
    expect(breaches(/from "\.\.?\/(?:ui\/)?sheet"/g, (file) => menus.has(file))).toEqual([])
  })

  it("puts a notice's buttons in AlertAction and its icon level with the first line", () => {
    // The owner, 2026-11-09: "ikon ile metin yatayda hizalanmamış"
    expect(breaches(/<AlertDescription\b[^>]*className="[^"]*items-center/g)).toEqual([])
    expect(breaches(/\[&>svg\]:translate-y-[\w.[\]-]+/g)).toEqual([])
  })

  it("has every text in Turkish and English, Turkish without exclamation marks", () => {
    const turkish = leaves(tr)
    expect(turkish.map(([key]) => key).sort()).toEqual(
      leaves(en)
        .map(([key]) => key)
        .sort()
    )
    expect(turkish.filter(([, text]) => text.includes("!")).map(([key]) => key)).toEqual([])
  })
})
