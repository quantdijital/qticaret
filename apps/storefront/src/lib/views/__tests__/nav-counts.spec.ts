import { describe, expect, it } from "vitest"
import type { NavCategoryView } from "@qticaret/ui"
import { withNavCounts } from "../nav-counts"

// The menu's badges: `/store/category-counts` by category id, the menu by path
const PATHS = {
  pcat_a: "/kategori/a",
  pcat_a1: "/kategori/a/a1",
  pcat_a2: "/kategori/a/a2",
  pcat_b: "/kategori/b",
}

const MENU: NavCategoryView[] = [
  {
    label: "A",
    path: "/kategori/a",
    children: [
      { label: "A1", path: "/kategori/a/a1" },
      { label: "A2", path: "/kategori/a/a2" },
    ],
  },
  { label: "B", path: "/kategori/b", children: [] },
  { label: "Hakkımızda", path: "/hakkimizda", children: [] },
]

describe("withNavCounts", () => {
  it("gives each category's entry and child its product count", () => {
    const menu = withNavCounts(
      MENU,
      PATHS,
      new Map([
        ["pcat_a", 58],
        ["pcat_a1", 5],
        ["pcat_a2", 11],
        ["pcat_b", 24],
      ])
    )
    expect(menu.map((entry) => [entry.label, entry.count])).toEqual([
      ["A", 58],
      ["B", 24],
      ["Hakkımızda", undefined],
    ])
    expect(menu[0]?.children.map((child) => child.count)).toEqual([5, 11])
  })

  it("leaves a 0, a missing or a broken count out, and every entry in the menu", () => {
    const menu = withNavCounts(
      MENU,
      PATHS,
      new Map([
        ["pcat_a", 3],
        ["pcat_a1", 0],
        ["pcat_b", Number.NaN],
      ])
    )
    expect(menu).toHaveLength(3)
    expect(menu[0]?.children.map((child) => [child.label, child.count])).toEqual([
      ["A1", undefined],
      ["A2", undefined],
    ])
    expect(menu[1]?.count).toBeUndefined()
  })

  it("shows no count at all when the backend did not answer", () => {
    const menu = withNavCounts(MENU, PATHS, new Map())
    expect(menu).toEqual(MENU)
  })
})
