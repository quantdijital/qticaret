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
  // A look's miniature draws the shop's colours, its words white on them as the shop shows them
  "features/storefront/gallery/design-thumb.tsx bg-white": "look miniature",
  "features/storefront/gallery/thumb-blocks.tsx bg-white": "look miniature",
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

// Fields that need no example: the browser draws them, or they hold no words
const NO_EXAMPLE_TYPES = new Set([
  "hidden",
  "checkbox",
  "radio",
  "file",
  "color",
  "date",
  "datetime-local",
  "time",
  "password",
  "range",
])

/** Where a JSX opening tag that starts at `from` ends, past braces and quoted values. */
function tagEnd(text: string, from: number): number {
  let depth = 0
  let quote: string | null = null
  for (let at = from; at < text.length; at++) {
    const char = text.charAt(at)
    if (quote) {
      quote = char === quote ? null : quote
    } else if (depth === 0 && (char === '"' || char === "'")) {
      quote = char
    } else if (char === "{") {
      depth++
    } else if (char === "}") {
      depth--
    } else if (char === ">" && depth === 0 && text.charAt(at - 1) !== "=") {
      return at
    }
  }
  return text.length
}

/** Each text field (`<Input>`, `<Textarea>`) without an example, as `file:line`. */
function fieldsWithoutExample(): string[] {
  return sources().flatMap((path) => {
    const file = relative(SRC, path)
    if (!file.endsWith(".tsx")) {
      return []
    }
    const text = readFileSync(path, "utf8")
    return [...text.matchAll(/<(?:Input|Textarea)\b/g)].flatMap((found) => {
      const tag = text.slice(found.index, tagEnd(text, found.index) + 1)
      const type = /\btype="([^"]+)"/.exec(tag)?.[1]
      const exempt =
        /\bplaceholder\b/.test(tag) ||
        (type !== undefined && NO_EXAMPLE_TYPES.has(type)) ||
        // Shows a value, takes none
        /\breadOnly(?:\s|\/|>|=\{true\})/.test(tag)
      return exempt ? [] : [`${file}:${text.slice(0, found.index).split("\n").length}`]
    })
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

  it("shows an example in every text field", () => {
    // The owner, 2026-11-26: "paneldeki inputların büyük çoğunluğunda placeholder yok". The
    // example is a value or a format (ornek@alanadi.com, 0532 123 45 67), never the label again.
    // A field with nothing to show says why in a `// placeholder-exempt: …` line inside its tag
    // (a password or a one-time code). The `placeholder` word inside the tag counts, so that
    // comment does too.
    expect(fieldsWithoutExample()).toEqual([])
  })

  it("opens a record in the standard dialog, never in a side sheet", () => {
    // The owner, 2026-11-06: a row opens one dialog on the size scale. The phone's menu
    // (admin-ui's sidebar) and the full-screen theme editor's own drawers stay sheets. The
    // assistant opens no record: it is a side panel by the owner's wish (adr/0079, "like VS
    // Code's side bar"), on the phone a sheet. "Sayfayı düzenle" opens no record either: it
    // arranges the product page, which follows it behind (the owner, 2026-11-25: not a modal).
    const drawers = new Set([
      "features/storefront/editor/editor-shell.tsx",
      "features/storefront/editor/revisions-sheet.tsx",
      "features/assistant/assistant-panel.tsx",
      "features/products/layout/layout-sheet.tsx",
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
