import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// A plain function or constant exported from a `"use client"` module is, on
// the server, only a client reference: calling it from a server component
// throws ("Attempted to call x() from the server but x is on the client")
// and the whole page answers 500. Vitest renders without that boundary, so
// a unit test of the page still passes (W-01, 2026-11-15: the framed card's
// `cardButtonClass` broke every page with a "Seçenekler" link). A server
// module may take only components (capitalised names) from a client module;
// a helper both sides need lives in a module without the directive.

const REPO = path.resolve(import.meta.dirname, "../../../..")
const STOREFRONT_SRC = path.join(REPO, "apps/storefront/src")
const ROOTS = [
  STOREFRONT_SRC,
  path.join(REPO, "packages/ui/src"),
  ...readdirSync(path.join(REPO, "packages/themes")).map((name) =>
    path.join(REPO, "packages/themes", name, "src")
  ),
]
const PACKAGE_DIRS = [
  path.join(REPO, "packages/types"),
  path.join(REPO, "packages/ui"),
  ...readdirSync(path.join(REPO, "packages/themes")).map((name) =>
    path.join(REPO, "packages/themes", name)
  ),
]
const ALIASES: Record<string, string> = {
  "@qticaret/storefront-theme": path.join(STOREFRONT_SRC, "themes/atolye.ts"),
  "@qticaret/storefront-theme-error": path.join(STOREFRONT_SRC, "themes/atolye-error.ts"),
}

interface Files {
  isFile: (file: string) => boolean
  read: (file: string) => string
}

const DISK: Files = {
  isFile: (file) => existsSync(file) && statSync(file).isFile(),
  read: (file) => readFileSync(file, "utf8"),
}

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

function fromPackage(specifier: string): string | undefined {
  const name = specifier.split("/").slice(0, 2).join("/")
  const pkg = PACKAGES.get(name)
  if (!pkg) return undefined
  const subpath = `.${specifier.slice(name.length)}`
  for (const [key, target] of Object.entries(pkg.exports)) {
    const entry = typeof target === "string" ? target : target.default
    if (!entry) continue
    const [head = "", tail = ""] = key.split("*")
    if (key === subpath) return path.join(pkg.dir, entry)
    if (key.includes("*") && subpath.startsWith(head) && subpath.endsWith(tail)) {
      return path.join(
        pkg.dir,
        entry.replace("*", subpath.slice(head.length, -tail.length || undefined))
      )
    }
  }
  return undefined
}

const asFile = (files: Files, base: string) =>
  [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(files.isFile)

function resolve(files: Files, specifier: string, from: string): string | undefined {
  if (specifier.startsWith(".")) return asFile(files, path.resolve(path.dirname(from), specifier))
  if (specifier.startsWith("@/"))
    return asFile(files, path.join(STOREFRONT_SRC, specifier.slice(2)))
  return ALIASES[specifier] ?? fromPackage(specifier)
}

/** A `"use client"` directive before any statement (comments may come first). */
const isClient = (source: string) =>
  /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/.test(source)

/** The value names of `{ a, b as c, type T }`: [imported, local] pairs. */
const namesOf = (list: string) =>
  list
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith("type "))
    .map((part) => part.split(/\s+as\s+/).map((each) => each.trim()))

/**
 * Where `name` exported by `file` is defined: a barrel without the
 * directive passes it on (`export { name } from`, `export * from`); a client
 * module is the end of the way.
 */
function originOf(
  files: Files,
  file: string,
  name: string,
  seen = new Set<string>()
): string | undefined {
  if (seen.has(file)) return undefined
  seen.add(file)
  const source = files.read(file)
  if (isClient(source) || declares(source, name)) return file
  for (const match of source.matchAll(/^export\s+\{([^}]*)\}\s+from\s+["']([^"']+)["']/gm)) {
    const pair = namesOf(match[1] ?? "").find(
      ([original, exported = original]) => exported === name
    )
    if (!pair) continue
    const next = resolve(files, match[2] ?? "", file)
    return next ? originOf(files, next, pair[0] ?? name, seen) : undefined
  }
  for (const match of source.matchAll(/^export\s+\*\s+from\s+["']([^"']+)["']/gm)) {
    const next = resolve(files, match[1] ?? "", file)
    const origin = next ? originOf(files, next, name, seen) : undefined
    if (origin && declares(files.read(origin), name)) return origin
  }
  return undefined
}

/** `file` declares `name` itself: `export const name`, `export { name }`. */
function declares(source: string, name: string): boolean {
  const declaration = new RegExp(
    `^export\\s+(?:async\\s+)?(?:const|let|var|function\\*?|class|enum)\\s+${name}\\b`,
    "m"
  )
  if (declaration.test(source)) return true
  return [...source.matchAll(/^export\s+\{([^}]*)\}(?!\s*from)/gm)].some((match) =>
    namesOf(match[1] ?? "").some(([original, exported = original]) => exported === name)
  )
}

const IMPORT = /^import\s+(?!type\b)(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s+["']([^"']+)["']/gm

/** Every server module's value import of a non-component from a client module. */
function clientValuesCalledOnServer(files: Files, sources: readonly string[]): string[] {
  const found: string[] = []
  for (const file of sources) {
    const source = files.read(file)
    if (isClient(source)) continue
    for (const match of source.matchAll(IMPORT)) {
      const target = resolve(files, match[2] ?? "", file)
      if (!target || !isSource(target)) continue
      for (const [name = ""] of namesOf(match[1] ?? "")) {
        const origin = originOf(files, target, name)
        // Components cross the boundary by design: only a capitalised name is one
        if (!origin || !isClient(files.read(origin)) || /^[A-Z]/.test(name)) continue
        found.push(`${file}: ${name} from ${origin}`)
      }
    }
  }
  return found
}

describe("the client boundary", () => {
  it("no server module takes a function or constant from a `use client` module", () => {
    expect(clientValuesCalledOnServer(DISK, ROOTS.flatMap(sourcesUnder))).toEqual([])
  })

  it("catches a server module calling a client module's helper, directly or through a barrel", () => {
    const virtual: Record<string, string> = {
      "/v/Quick.tsx": [
        '"use client"',
        "export const buttonClass = () => 'x'",
        "export function Quick() { return null }",
      ].join("\n"),
      "/v/index.ts":
        'export { buttonClass as look, Quick } from "./Quick"\nexport * from "./Quick"',
      "/v/Card.tsx": 'import { Quick, buttonClass } from "./Quick"',
      "/v/Tile.tsx": 'import { look, Quick } from "./index"',
      "/v/all.ts": 'export * from "./Quick"\nexport const local = 1',
      "/v/Row.tsx": 'import { buttonClass, local } from "./all"',
      "/v/Fine.tsx": 'import { type Thing, Quick } from "./Quick"',
      "/v/Client.tsx": '"use client"\nimport { buttonClass } from "./Quick"',
    }
    const files: Files = {
      isFile: (file) => file in virtual,
      read: (file) => virtual[file] ?? "",
    }
    expect(
      clientValuesCalledOnServer(files, [
        "/v/Card.tsx",
        "/v/Tile.tsx",
        "/v/Row.tsx",
        "/v/Fine.tsx",
        "/v/Client.tsx",
      ])
    ).toEqual([
      "/v/Card.tsx: buttonClass from /v/Quick.tsx",
      "/v/Tile.tsx: look from /v/Quick.tsx",
      "/v/Row.tsx: buttonClass from /v/Quick.tsx",
    ])
  })
})
