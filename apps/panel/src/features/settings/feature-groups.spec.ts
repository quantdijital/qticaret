import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import tr from "../../locales/tr.json" with { type: "json" }
import en from "../../locales/en.json" with { type: "json" }
import type { FeatureState } from "./api/features"
import { FEATURE_GROUPS, groupFeatures, groupOf, matchesSearch } from "./feature-groups"

// Tests run from the package; the backend's registry is the list of flags (adr/0012)
const REGISTRY = join(process.cwd(), "../backend/src/modules/platform-settings/features.ts")

/** Every flag key the backend registers: its `export const NAME = "area.flag"` lines. */
function registeredKeys(): string[] {
  const source = readFileSync(REGISTRY, "utf8")
  return [...source.matchAll(/^export const [A-Z_]+ = "([a-z_]+\.[a-z_]+)"/gm)].map(
    (match) => match[1] ?? ""
  )
}

const flag = (key: string, enabled = false): FeatureState => ({
  key,
  default: false,
  owner: "tenant",
  enabled,
})

describe("feature groups", () => {
  it("reads the backend's flags", () => {
    expect(registeredKeys()).toContain("catalog.non_physical")
    expect(registeredKeys().length).toBeGreaterThan(10)
  })

  it("puts every registered flag in a group", () => {
    const missing = registeredKeys().filter((key) => groupOf(key) === "other")
    expect(missing, "add these flags to FEATURE_GROUPS").toEqual([])
  })

  it("puts no flag in two groups", () => {
    const keys = FEATURE_GROUPS.flatMap((group) => [...group.keys])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("names every group and every registered flag in both languages", () => {
    for (const locale of [tr, en]) {
      const features = locale.settings.features as {
        groups: Record<string, { title: string; description: string }>
        flags: Record<string, Record<string, { label?: string; summary?: string }>>
      }
      for (const group of [...FEATURE_GROUPS.map((entry) => entry.id), "other"]) {
        expect(features.groups[group]?.title).toBeTruthy()
      }
      for (const key of registeredKeys()) {
        const [area = "", name = ""] = key.split(".")
        expect(features.flags[area]?.[name]?.label, key).toBeTruthy()
        expect(features.flags[area]?.[name]?.summary, key).toBeTruthy()
      }
    }
  })

  it("orders flags by group, leaves empty groups out and keeps unknown ones", () => {
    const groups = groupFeatures([
      flag("ai.reviews"),
      flag("catalog.booking"),
      flag("new.flag"),
      flag("catalog.non_physical"),
    ])
    expect(groups.map((group) => group.id)).toEqual(["catalog", "ai", "other"])
    expect(groups[0]?.features.map((feature) => feature.key)).toEqual([
      "catalog.non_physical",
      "catalog.booking",
    ])
  })

  it("matches every word of a search, Turkish case folded", () => {
    expect(matchesSearch(["Kapıda ödeme", "Müşteri öder"], "KAPIDA")).toBe(true)
    expect(matchesSearch(["İndirim kodu"], "indirim")).toBe(true)
    expect(matchesSearch(["Kapıda ödeme"], "kapıda kargo")).toBe(false)
  })
})
