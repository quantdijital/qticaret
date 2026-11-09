import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * The Atölye stylesheet scans only the workspace files the theme reaches
 * (`atolye.css`, docs/21 2026-11-06). A file it reaches but Tailwind does
 * not scan would ship without its classes: the page would lose part of its
 * look with no error. This walks the imports from the theme's entries and
 * the storefront's own code and checks each reached file of `packages/ui`
 * against the stylesheet's `@source` lines.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../../../../..")
const STOREFRONT = join(ROOT, "apps/storefront/src")
const PACKAGES: Readonly<Record<string, { dir: string; exports: Record<string, string> }>> = {
  "@qticaret/ui": {
    dir: "packages/ui/src",
    exports: { ".": "index.ts" },
  },
  "@qticaret/theme-atolye": {
    dir: "packages/themes/atolye/src",
    exports: { ".": "index.ts", "./error": "ErrorPage.tsx" },
  },
}

function asFile(base: string): string | null {
  for (const ending of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const path = base + ending
    if (existsSync(path) && statSync(path).isFile()) {
      return path
    }
  }
  return null
}

function resolveImport(spec: string, from: string): string | null {
  if (spec.startsWith(".")) {
    return asFile(resolve(dirname(from), spec))
  }
  if (spec.startsWith("@/")) {
    return asFile(join(STOREFRONT, spec.slice(2)))
  }
  if (spec === "@qticaret/storefront-theme") {
    return join(STOREFRONT, "themes/atolye.ts")
  }
  if (spec === "@qticaret/storefront-theme-error") {
    return join(STOREFRONT, "themes/atolye-error.ts")
  }
  for (const [name, { dir, exports }] of Object.entries(PACKAGES)) {
    if (spec === name || spec.startsWith(`${name}/`)) {
      const sub = spec === name ? "." : `.${spec.slice(name.length)}`
      const mapped = exports[sub]
      return mapped ? join(ROOT, dir, mapped) : asFile(join(ROOT, dir, sub))
    }
  }
  return null
}

const IMPORT = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g

/** Every module the given ones reach by value imports (type-only imports bring no classes). */
function reached(entries: readonly string[]): Set<string> {
  const seen = new Set<string>()
  const stack = [...entries]
  for (let file = stack.pop(); file !== undefined; file = stack.pop()) {
    if (seen.has(file) || !/\.tsx?$/.test(file)) {
      continue
    }
    seen.add(file)
    for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const target = match[2] ? null : resolveImport(match[3] ?? "", file)
      if (target) {
        stack.push(target)
      }
    }
  }
  return seen
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "test" ? [] : sourceFiles(path)
    }
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** `a/{b,c}/*.ts{,x}` as the paths it can name, `*` kept for the match. */
function expand(pattern: string): string[] {
  const brace = /\{([^{}]*)\}/.exec(pattern)
  if (!brace) {
    return [pattern]
  }
  return (brace[1] ?? "")
    .split(",")
    .flatMap((part) =>
      expand(pattern.slice(0, brace.index) + part + pattern.slice(brace.index + brace[0].length))
    )
}

const asRegExp = (glob: string) =>
  new RegExp(`^${glob.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`)

const css = readFileSync(join(STOREFRONT, "themes/atolye.css"), "utf8")
const scanned = [...css.matchAll(/@source\s+"([^"]+)"/g)].flatMap((match) =>
  expand(relative(ROOT, resolve(join(STOREFRONT, "themes"), match[1] ?? "")))
)
const isScanned = (file: string) =>
  scanned.some((glob) => file === glob || file.startsWith(`${glob}/`) || asRegExp(glob).test(file))

describe("the Atölye stylesheet's sources", () => {
  const reachedFiles = [...reached(sourceFiles(STOREFRONT))].map((file) => relative(ROOT, file))
  const files = reachedFiles.filter((file) => file.startsWith("packages/ui/src/"))

  it("finds the theme's own pages and the primitives it uses", () => {
    expect(reachedFiles).toContain("packages/themes/atolye/src/BrandsPage.tsx")
    expect(files).toContain("packages/ui/src/ResponsiveImage.tsx")
    // Nothing reaches outside the theme and the primitives (the base theme is gone, adr/0057)
    expect(
      reachedFiles.filter(
        (file) =>
          file.startsWith("packages/") && !/^packages\/(ui|themes\/atolye|types)\//.test(file)
      )
    ).toEqual([])
  })

  it("scans every workspace file the theme or the storefront reaches", () => {
    expect(files.filter((file) => !isScanned(file))).toEqual([])
  })
})
