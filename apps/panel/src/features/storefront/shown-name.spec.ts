import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import { SYSTEM_PAGES } from "@/features/storefront/api/menus"
import type { SystemPage } from "@/features/storefront/api/menus"
import type { MenuRow } from "@/features/storefront/menu-rows"
import { shownName } from "./shown-name"

const system = (target: SystemPage): MenuRow => ({
  key: target,
  depth: 0,
  to: { kind: "system", target },
  label: "",
  name: null,
  path: null,
  broken: false,
})

describe("shownName", () => {
  it("names the storefront's index and sale pages in both languages", () => {
    const pages: SystemPage[] = ["categories", "brands", "sale"]
    expect(SYSTEM_PAGES).toEqual(expect.arrayContaining(pages))
    const names = (lang: string) =>
      pages.map((page) => shownName(i18next.getFixedT(lang), system(page)))
    expect(names("tr")).toEqual(["Tüm kategoriler", "Markalar", "Kampanyalar"])
    expect(names("en")).toEqual(["All categories", "Brands", "Sale"])
  })

  it("has a name for every page the storefront knows", () => {
    for (const page of SYSTEM_PAGES) {
      expect(shownName(i18next.getFixedT("tr"), system(page))).not.toContain("storefront.menus")
    }
  })
})
