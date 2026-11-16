import { describe, expect, it } from "vitest"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"

interface Tree {
  [key: string]: string | Tree
}

/** Every leaf key under a tree, dotted. */
const keysOf = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`)
  )

const at = (tree: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree)

describe("the wholesale screens' words", () => {
  it("are the same keys in Turkish and English", () => {
    expect(keysOf(tr.wholesale as Tree).sort()).toEqual(keysOf(en.wholesale as Tree).sort())
  })

  it.each([
    // The menu item of its own (the owner, 2026-11-16), its three tabs and the retail list's
    // pointer to wholesale orders
    "nav.wholesale",
    "wholesale.nav.accounts",
    "wholesale.nav.tiers",
    "wholesale.nav.orders",
    "orders.wholesaleMatchesLink",
    // Ayarlar > Özellikler lists the flag by its key (`customers.wholesale`)
    "settings.features.flags.customers.wholesale.label",
    "settings.features.flags.customers.wholesale.description",
  ])("name %s in both languages", (path) => {
    expect(typeof at(tr, path)).toBe("string")
    expect(typeof at(en, path)).toBe("string")
  })

  it("name no Toptancılar tab under Müşteriler any more (the owner, 2026-11-16)", () => {
    expect(at(tr, "customers.sectionWholesale")).toBeUndefined()
    expect(at(en, "customers.sectionWholesale")).toBeUndefined()
  })

  it("name no invitation template any more (Ek 2026-11-15 (2))", () => {
    expect(
      at(tr, "settings.notifications.templates.names.account.wholesale_invite")
    ).toBeUndefined()
    expect(
      at(en, "settings.notifications.templates.names.account.wholesale_enabled")
    ).toBeUndefined()
  })
})
