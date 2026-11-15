import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The theme editor's bridge never reaches a live page (adr/0065 §2, §8):
 * the preview page alone renders its loader, the loader alone fetches it
 * (a dynamic import, client only), and the bridge's schemas are read by
 * the bridge alone. Next splits client code by route, so no other route's
 * bundle carries a byte of it. A source check: the build check over
 * `.next` (§8) needs a production build.
 */

const REPO = path.resolve(import.meta.dirname, "../../../../../..")
const ROOTS = [
  path.join(REPO, "apps/storefront/src"),
  path.join(REPO, "packages/ui/src"),
  ...readdirSync(path.join(REPO, "packages/themes")).map((name) =>
    path.join(REPO, "packages/themes", name, "src")
  ),
]
const BRIDGE_DIR = path.join(REPO, "apps/storefront/src/components/editor-bridge")
const PREVIEW_PAGE = path.join(REPO, "apps/storefront/src/app/onizleme/[token]/page.tsx")

const isSource = (file: string) =>
  /\.tsx?$/.test(file) && !/\.(spec|test)\.tsx?$/.test(file) && !file.includes("__tests__")

function sourcesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (name === "node_modules") return []
    return statSync(full).isDirectory() ? sourcesUnder(full) : isSource(full) ? [full] : []
  })
}

const SOURCES = ROOTS.flatMap(sourcesUnder)
const importers = (pattern: RegExp) =>
  SOURCES.filter((file) => pattern.test(readFileSync(file, "utf8"))).map((file) =>
    path.relative(REPO, file)
  )

describe("the editor bridge's reach", () => {
  it("is rendered by the preview page alone", () => {
    expect(importers(/components\/editor-bridge\/loader["']/)).toEqual([
      path.relative(REPO, PREVIEW_PAGE),
    ])
  })

  it("is fetched by its loader alone, on the client, as its own chunk", () => {
    const loader = readFileSync(path.join(BRIDGE_DIR, "loader.tsx"), "utf8")
    expect(loader).toMatch(/^"use client"/)
    expect(loader).toContain('import("./editor-bridge")')
    expect(loader).toContain("ssr: false")
    expect(
      importers(/from ["'][^"']*editor-bridge\/editor-bridge["']|from ["']\.\/editor-bridge["']/)
    ).toEqual([])
  })

  it("keeps its schemas and core inside the bridge", () => {
    const inside = (file: string) => file.startsWith(path.relative(REPO, BRIDGE_DIR))
    expect(importers(/@qticaret\/types\/editor-bridge/).filter((file) => !inside(file))).toEqual([])
    expect(importers(/bridge-core["']/).filter((file) => !inside(file))).toEqual([])
  })

  it("loads only for the live session's token on the preview page", () => {
    const page = readFileSync(PREVIEW_PAGE, "utf8")
    const session = page.indexOf("if (SESSION_TOKEN.test(token))")
    const design = page.indexOf("if (LAYOUT_TOKEN.test(token))")
    const bridge = page.indexOf("<EditorBridgeLoader")
    expect(session).toBeGreaterThan(-1)
    expect(bridge).toBeGreaterThan(session)
    expect(bridge).toBeLessThan(design)
  })
})
