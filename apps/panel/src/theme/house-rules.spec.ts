import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import en from "../locales/en.json" with { type: "json" }
import tr from "../locales/tr.json" with { type: "json" }

/**
 * Docs/18 §9 held by a test: colours, corners and shadows come from the
 * theme's tokens, and every text is in both languages, Turkish without
 * exclamation marks. A rule broken on purpose is listed with its reason.
 * The shared primitives and patterns keep the same rules in their own
 * package (packages/admin-ui `src/house-rules.spec.ts`).
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
  // A sent e-mail is drawn on white, as a mail program shows it
  "features/settings/components/template-preview-card.tsx bg-white": "e-mail preview",
  "features/bulk-messages/editor/email-frame.tsx bg-white": "e-mail preview",
  // Cameras read dark modules on white, whatever the theme
  "features/security/components/authenticator-link.tsx bg-white": "QR code",
  "features/settings/components/etbis-qr-field.tsx bg-white": "QR code",
  // The browser's colour input takes a hex value only
  "features/settings/components/appearance-fields.tsx #000000": "colour input",
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
  [key: string]: string | string[] | Tree
}

/** Each text with its key; a list of words (an example's suggestions) as one text. */
function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") {
      return [[path, value] as [string, string]]
    }
    return Array.isArray(value)
      ? [[path, value.join(" ")] as [string, string]]
      : leaves(value, path)
  })
}

describe("the panel's house rules (docs/18 §9)", () => {
  it("takes colours and corners from the theme", () => {
    expect(breaches(PALETTE)).toEqual([])
    // The theme engine and its charts define the colours
    expect(breaches(HEX, (file) => file.startsWith("theme/"))).toEqual([])
    expect(breaches(PX_CORNER)).toEqual([])
  })

  it("types numbers in the panel's own field, never the browser's spinner", () => {
    // The owner, 2026-11-03: "artır azalt ikonları default ikonlar olarak geliyor"
    // (NumberField itself is @qticaret/admin-ui's)
    expect(breaches(/<Input\b[^>]*\btype="number"/g)).toEqual([])
    expect(breaches(/<input\b[^>]*\btype="number"/g)).toEqual([])
  })

  it("opens a record in the standard dialog, never in a side sheet", () => {
    // The owner, 2026-11-06: a row opens one dialog on the size scale. The phone's menu
    // (admin-ui's sidebar) and the full-screen theme editor's own drawers stay sheets. The
    // assistant opens no record: it is a side panel by the owner's wish (adr/0079, "like VS
    // Code's side bar"), on the phone a sheet.
    const drawers = new Set([
      "features/storefront/editor/editor-shell.tsx",
      "features/storefront/editor/revisions-sheet.tsx",
      "features/assistant/assistant-panel.tsx",
    ])
    expect(breaches(/from "@qticaret\/admin-ui\/ui\/sheet"/g, (file) => drawers.has(file))).toEqual(
      []
    )
  })

  it("puts a notice's buttons in AlertAction and its icon level with the first line", () => {
    // The owner, 2026-11-09: "ikon ile metin yatayda hizalanmamış". Words and buttons in one
    // centred flex row put the words 6 px under the icon; `AlertAction` centres the buttons on
    // the first line instead.
    expect(breaches(/<AlertDescription\b[^>]*className="[^"]*items-center/g)).toEqual([])
    // An icon pushed down by a fixed amount fits one line height only: `h-lh` fits them all
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
