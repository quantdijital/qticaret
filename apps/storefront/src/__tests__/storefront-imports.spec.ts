import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Turbopack (`next dev`) cannot resolve a relative `./x.js` specifier to the
// `x.ts` source of a workspace package; Vitest can, so a unit test of the
// importing module still passes while every page of the storefront fails.
// `@qticaret/types` writes its re-exports that way (NodeNext, for the
// backend): the storefront takes its values from subpaths whose files import
// nothing relative (`@qticaret/types/section-variants`). This walks every
// value import the storefront's bundle follows and fails on such a specifier.

const REPO = path.resolve(import.meta.dirname, "../../../..")
const STOREFRONT_SRC = path.join(REPO, "apps/storefront/src")
const PACKAGE_DIRS = [
  path.join(REPO, "packages/types"),
  path.join(REPO, "packages/ui"),
  ...readdirSync(path.join(REPO, "packages/themes")).map((name) =>
    path.join(REPO, "packages/themes", name)
  ),
]

type Exports = Record<string, string | { default?: string }>
const PACKAGES = new Map(
  PACKAGE_DIRS.map((dir) => {
    const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
      name: string
      exports: Exports
    }
    return [manifest.name, { dir, exports: manifest.exports }] as const
  })
)

const isSource = (file: string) =>
  /\.tsx?$/.test(file) && !/\.(spec|test)\.tsx?$/.test(file) && !file.includes("__tests__")

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (name === "node_modules") return []
    return statSync(full).isDirectory() ? sourcesUnder(full) : isSource(full) ? [full] : []
  })
}

// `import`/`export … from "x"` and `import "x"`; `type` ones are erased by the compiler
const SPECIFIER = /\b(?:import|export)\s+(type\s+)?(?:[\w$*{}\s,]+?\s+from\s+)?["']([^"']+)["']/g
const valueSpecifiers = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(SPECIFIER)]
    .filter((match) => !match[1])
    .map((match) => match[2] ?? "")

function asFile(base: string): string | undefined {
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile()
  )
}

function fromPackage(specifier: string): string | undefined {
  const name = specifier.split("/").slice(0, 2).join("/")
  const pkg = PACKAGES.get(name)
  if (!pkg) return undefined
  const subpath = `.${specifier.slice(name.length)}`
  for (const [key, target] of Object.entries(pkg.exports)) {
    const entry = typeof target === "string" ? target : target.default
    if (!entry) continue
    const [head, tail = ""] = key.split("*")
    if (key === subpath) return path.join(pkg.dir, entry)
    if (key.includes("*") && subpath.startsWith(head ?? "") && subpath.endsWith(tail)) {
      const star = subpath.slice((head ?? "").length, subpath.length - tail.length)
      return path.join(pkg.dir, entry.replace("*", star))
    }
  }
  return undefined
}

function unresolvableForTurbopack(): string[] {
  const seen = new Set<string>()
  const queue = [
    STOREFRONT_SRC,
    ...PACKAGE_DIRS.slice(1).map((dir) => path.join(dir, "src")),
  ].flatMap(sourcesUnder)
  const found: string[] = []
  for (let file = queue.shift(); file; file = queue.shift()) {
    if (seen.has(file)) continue
    seen.add(file)
    for (const specifier of valueSpecifiers(file)) {
      if (specifier.startsWith(".") && /\.m?js$/.test(specifier)) {
        found.push(`${path.relative(REPO, file)}: "${specifier}"`)
        continue
      }
      const next = specifier.startsWith(".")
        ? asFile(path.resolve(path.dirname(file), specifier))
        : specifier.startsWith("@/")
          ? asFile(path.join(STOREFRONT_SRC, specifier.slice(2)))
          : fromPackage(specifier)
      if (next && isSource(next)) queue.push(next)
    }
  }
  return found
}

describe("the storefront's value imports", () => {
  it("reach no relative `.js` specifier, which Turbopack cannot resolve to `.ts` source", () => {
    expect(unresolvableForTurbopack()).toEqual([])
  })

  it("takes the contract's values from subpaths that import nothing relative", () => {
    for (const subpath of [
      "@qticaret/types/section-variants",
      "@qticaret/types/section-look",
      "@qticaret/types/section-marquee",
      "@qticaret/types/section-banner",
      "@qticaret/types/section-catalog",
    ]) {
      const file = fromPackage(subpath)
      expect(file && existsSync(file)).toBe(true)
      expect(valueSpecifiers(file ?? "").filter((each) => each.startsWith("."))).toEqual([])
    }
  })

  it("would catch a value import from the `@qticaret/types` root", () => {
    expect(valueSpecifiers(path.join(REPO, "packages/types/src/index.ts"))).toContain(
      "./appearance.js"
    )
    expect(fromPackage("@qticaret/types")).toBe(path.join(REPO, "packages/types/src/index.ts"))
  })
})
