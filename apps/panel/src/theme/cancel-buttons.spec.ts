import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import tr from "../locales/tr.json" with { type: "json" }

/**
 * Docs/18: every "Vazgeç" button is drawn with the `cancel` variant (red
 * text), so backing out reads the same everywhere; filled red stays for
 * destructive actions. Finds each text whose Turkish is "Vazgeç" and checks
 * the button around it. The shared patterns are read too.
 */

// Tests run from the package
const PANEL = join(process.cwd(), "src")
const SHARED = join(process.cwd(), "../../packages/admin-ui/src")
const ROOTS = [PANEL, SHARED]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return sources(path)
    }
    return name.endsWith(".tsx") && !name.endsWith(".spec.tsx") ? [path] : []
  })
}

interface Tree {
  [key: string]: string | string[] | Tree
}

function cancelKeys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") {
      return value === "Vazgeç" ? [path] : []
    }
    return Array.isArray(value) ? [] : cancelKeys(value, path)
  })
}

const uiTr = JSON.parse(readFileSync(join(SHARED, "locales/tr.json"), "utf8")) as Tree
const KEYS = new Set([...cancelKeys(tr), ...cancelKeys(uiTr)])

/** Where the opening tag that starts at `start` ends, skipping `{...}`. */
function tagEnd(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") depth--
    else if (text[i] === ">" && depth === 0) return i
  }
  return text.length
}

function breaches(root: string): string[] {
  return sources(root).flatMap((path) => {
    const text = readFileSync(path, "utf8")
    // `const S = "customers.segments"` lets t(`${S}.cancel`) be read
    const names: Record<string, string> = Object.fromEntries(
      [...text.matchAll(/const ([A-Z]\w*) = "([^"]+)"/g)].map((m): [string, string] => [
        m[1] ?? "",
        m[2] ?? "",
      ])
    )
    return [...text.matchAll(/\bt\(\s*(["'`])([^"'`]+)\1/g)].flatMap((match) => {
      const key = (match[2] ?? "").replace(/\$\{(\w+)\}/g, (_, name: string) => names[name] ?? "?")
      if (!KEYS.has(key)) {
        return []
      }
      const at = match.index
      const button = text.lastIndexOf("<Button", at)
      const alert = text.lastIndexOf("<AlertDialogCancel", at)
      const line = `${relative(root, path)}:${text.slice(0, at).split("\n").length}`
      // The alert dialog's own cancel is drawn as `cancel` unless told otherwise
      if (alert > button && !text.slice(alert, tagEnd(text, alert)).includes("variant=")) {
        return []
      }
      const open = Math.max(button, alert)
      if (open < 0 || text.lastIndexOf("</Button>", at) > open) {
        return [`${line} not in a button`]
      }
      return text.slice(open, tagEnd(text, open)).includes('variant="cancel"') ? [] : [line]
    })
  })
}

describe("cancel buttons (docs/18)", () => {
  it("finds the texts it guards", () => {
    expect(KEYS.has("common.cancel")).toBe(true)
  })

  it.each(ROOTS.map((root) => [relative(process.cwd(), root), root]))(
    "draws every Vazgeç button as cancel in %s",
    (_, root) => {
      expect(breaches(root)).toEqual([])
    }
  )
})
