import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"

const ENTRY = fileURLToPath(new URL("../themes/atolye.css", import.meta.url))

interface Manifest {
  style?: string
  exports?: Record<string, unknown>
}

/** A bare `@import` id from a directory: a package's CSS file by its subpath or its `style` entry. */
function resolveBare(id: string, base: string): string {
  const require = createRequire(`${base}/`)
  const parts = id.split("/")
  const size = id.startsWith("@") ? 2 : 1
  const name = parts.slice(0, size).join("/")
  const subpath = parts.slice(size).join("/")
  if (subpath) {
    return require.resolve(id)
  }
  // Its manifest, found up the tree (some packages do not export it)
  let manifest = ""
  for (let dir = base; !manifest; dir = dirname(dir)) {
    const candidate = resolve(dir, "node_modules", name, "package.json")
    if (existsSync(candidate)) {
      manifest = candidate
    } else if (dirname(dir) === dir) {
      throw new Error(`no package ${name} above ${base}`)
    }
  }
  const { style, exports } = JSON.parse(readFileSync(manifest, "utf8")) as Manifest
  const root = exports?.["."]
  const exported =
    root && typeof root === "object" ? (root as Record<string, unknown>)["style"] : undefined
  return resolve(
    dirname(manifest),
    typeof exported === "string" ? exported : (style ?? "index.css")
  )
}

/**
 * The Atölye theme's stylesheet as Tailwind builds it (the storefront's
 * `themes/atolye.css`), for the given class names only: no source scan,
 * so the test names every utility whose rule it reads.
 */
export async function buildAtolyeCss(candidates: string[]): Promise<string> {
  const compiler = await compile(readFileSync(ENTRY, "utf8"), {
    base: dirname(ENTRY),
    loadStylesheet: (id, base) => {
      const path =
        id.startsWith(".") || id.startsWith("/") ? resolve(base, id) : resolveBare(id, base)
      return Promise.resolve({ path, base: dirname(path), content: readFileSync(path, "utf8") })
    },
    loadModule: () => Promise.reject(new Error("the theme loads no plugin")),
  })
  return compiler.build(candidates)
}
