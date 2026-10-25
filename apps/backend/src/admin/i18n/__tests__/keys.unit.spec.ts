import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import en from "../en.json"
import tr from "../tr.json"

const ROUTES = join(__dirname, "../../routes")

const routePages = (): string[] =>
  readdirSync(ROUTES, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => join(ROUTES, file))

const lookup = (catalog: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalog
    )

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  )
}

describe("admin translations", () => {
  it("define the same keys in Turkish and English", () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(tr).sort())
  })

  it("keep every key under the qticaret namespace prefix", () => {
    expect(Object.keys(tr)).toEqual(["qticaret"])
    expect(Object.keys(en)).toEqual(["qticaret"])
  })

  // The dashboard prints a sidebar label as it is unless the route names a
  // namespace (admin-sdk RouteConfig.translationNs)
  it("translate every sidebar label of our routes", () => {
    const pages = routePages()
    expect(pages.length).toBeGreaterThan(0)
    for (const page of pages) {
      const config = /defineRouteConfig\(\{([^}]*)\}\)/.exec(readFileSync(page, "utf8"))?.[1]
      const label = config && /label:\s*"([^"]+)"/.exec(config)?.[1]
      if (!config || !label) {
        continue
      }
      expect({ page, ns: /translationNs:\s*"translation"/.test(config) }).toEqual({
        page,
        ns: true,
      })
      expect({ page, tr: typeof lookup(tr, label) }).toEqual({ page, tr: "string" })
      expect({ page, en: typeof lookup(en, label) }).toEqual({ page, en: "string" })
    }
  })

  it("have no empty strings", () => {
    const strings = (value: unknown): unknown[] =>
      typeof value === "object" && value !== null ? Object.values(value).flatMap(strings) : [value]
    for (const text of [...strings(tr), ...strings(en)]) {
      expect(typeof text === "string" && text.trim().length > 0).toBe(true)
    }
  })
})
