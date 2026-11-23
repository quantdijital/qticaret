import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { RESERVED_ROOT_SEGMENTS } from "../paths"

/**
 * The storefront's own routes answer before the URL registry does: a
 * record whose path starts in one of them would never be reached. Every
 * root segment the storefront serves must be one the backend keeps
 * (docs/13 §2.2, adr/0017 Ek 2026-11-23).
 */

const STOREFRONT = join(__dirname, "../../../../../storefront/src")
const APP = join(STOREFRONT, "app")

// A route folder holds a page or a route handler somewhere below it
const isRoute = (folder: string): boolean =>
  readdirSync(folder, { withFileTypes: true }).some((entry) =>
    entry.isDirectory()
      ? isRoute(join(folder, entry.name))
      : /^(?:page|route)\.(?:tsx?|jsx?)$/.test(entry.name)
  )

/** The root segments the app router serves; route groups `(x)` are looked into. */
function rootSegments(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const name = entry.name
    // Catch-alls and dynamic segments ask the backend; `_x` is private, `%5Fx` Next's own
    if (!entry.isDirectory() || name.startsWith("[") || /^(?:_|%5F)/i.test(name)) {
      return []
    }
    if (name.startsWith("(") && name.endsWith(")")) {
      return rootSegments(join(folder, name))
    }
    return isRoute(join(folder, name)) ? [name] : []
  })
}

/** The string literals of an exported `const NAME = [...] as const` in the storefront's paths file. */
function listOf(source: string, name: string): string[] {
  const body = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`).exec(source)?.[1]
  if (body === undefined) {
    throw new Error(`${name} not found in the storefront's paths file`)
  }
  return [...body.replace(/\/\/.*$/gm, "").matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "")
}

describe("the storefront's own root segments", () => {
  const segments = rootSegments(APP)

  it("finds the app's routes", () => {
    expect(segments).toEqual(expect.arrayContaining(["sepet", "blog", "yasal"]))
  })

  it.each(segments)("keeps /%s reserved in the backend", (segment) => {
    expect(RESERVED_ROOT_SEGMENTS.has(segment)).toBe(true)
  })

  it("reserves the storefront's system roots and index pages in the backend", () => {
    const source = readFileSync(join(STOREFRONT, "lib/seo/paths.ts"), "utf8")
    const roots = listOf(source, "SYSTEM_ROOTS")
    const indexes = listOf(source, "STOREFRONT_INDEXES").map((path) => path.split("/")[1] ?? "")

    expect(roots.length).toBeGreaterThan(0)
    expect(indexes.length).toBeGreaterThan(0)
    for (const segment of [...roots, ...indexes]) {
      expect([segment, RESERVED_ROOT_SEGMENTS.has(segment)]).toEqual([segment, true])
    }
  })
})
