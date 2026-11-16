import { describe, expect, it, vi } from "vitest"
import type { StoreCategory } from "@qticaret/types"
import type { CategoryCardView } from "@qticaret/ui"
import { collageView, linkedCards } from "../category-cards"
import { collageSettings } from "../category-cards-data"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/store-api/requests", () => ({ allCategories: vi.fn(), pathsOf: vi.fn() }))
vi.mock("@/lib/store-api/extras", () => ({ categoryCounts: vi.fn() }))
vi.mock("../category-tiles", () => ({ picturedCategories: vi.fn() }))
vi.mock("../section-data", () => ({ namedCategories: vi.fn() }))

const t = (key: string) => key
const category = (id: string, parent: string | null, rank = 0): StoreCategory =>
  ({ id, name: `Ad ${id}`, handle: id, parent_category_id: parent, rank }) as StoreCategory

describe("the category collage's view (adr/0049 Ek 2026-11-15)", () => {
  it("reads the settings forgivingly: off the list, the collage's own defaults", () => {
    expect(collageSettings({})).toEqual({
      variant: "collage",
      columns: 4,
      columns_mobile: 1,
      height: "medium",
      lead: "on",
      links: 4,
    })
    expect(
      collageSettings({
        columns: 5 as never,
        height: "tall" as never,
        lead: true as never,
        links: 12,
      })
    ).toMatchObject({ columns: 4, height: "medium", lead: "on", links: 8 })
    expect(collageSettings({ columns: 2, height: "low", lead: "off", links: -3 })).toMatchObject({
      columns: 2,
      height: "low",
      lead: "off",
      links: 0,
    })
  })

  it("hands the theme its settings and the cards, the phone's two only when asked", () => {
    const settings = collageSettings({ lead: "off", height: "high" })
    expect(collageView(settings, [])).toEqual({
      columns: 4,
      height: "high",
      lead: false,
      cards: [],
    })
    expect(collageView({ ...settings, columns_mobile: 2 }, [])).toMatchObject({ phoneColumns: 2 })
  })

  it("gives each card at most `links` live subcategories with products, and its count", () => {
    const all = [
      category("top", null),
      category("a", "top", 1),
      category("b", "top", 2),
      category("c", "top", 3),
      category("empty", "top", 4),
    ]
    const named: { id: string; card: CategoryCardView }[] = [
      { id: "top", card: { label: "Ad top", path: "/top" } },
    ]
    const counts = new Map([
      ["top", 9],
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["empty", 0],
    ])
    const paths = { a: "/a", b: "/b", c: "/c", empty: "/empty" }
    const [two] = linkedCards(
      named,
      all,
      paths,
      counts,
      { links: 2, image_position: "top", show_count: true },
      t
    )
    expect(two?.children.map((child) => child.path)).toEqual(["/a", "/b"])
    expect(two?.count).toBe(9)
    const [none] = linkedCards(named, all, paths, counts, { links: 0, image_position: "top" }, t)
    expect(none?.children).toEqual([])
    expect(none).not.toHaveProperty("count")
  })
})
