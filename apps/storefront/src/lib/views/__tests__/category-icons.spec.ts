import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreCategoriesIcons, StoreCategoriesSection } from "@qticaret/types"
import { categoryCounts } from "@/lib/store-api/extras"
import { iconCategoriesView, initialOf } from "../category-icons"
import { namedCategories } from "../section-data"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/store-api/extras", () => ({ categoryCounts: vi.fn() }))
vi.mock("../section-data", () => ({ namedCategories: vi.fn() }))
vi.mock("../layout", () => ({ layoutLink: () => null }))

const t = (key: string) => key
const IMAGE = {
  src: "/m/plaj.jpg",
  alt: "Plaj",
  width: 80,
  height: 80,
  sources: { avif: null, webp: null },
}

const row = (
  over: Partial<StoreCategoriesIcons & StoreCategoriesSection> = {}
): StoreCategoriesSection & StoreCategoriesIcons => ({
  id: "ikonsira01",
  type: "categories",
  title: null,
  category_ids: ["pcat_a", "pcat_b", "pcat_c"],
  variant: "icons",
  disc: "tint",
  phone: "scroll",
  category_icons: { pcat_a: "mountain", pcat_c: "rocket" as never },
  ...over,
})

beforeEach(() => {
  vi.mocked(namedCategories).mockResolvedValue({
    categories: [],
    named: [
      { id: "pcat_a", card: { label: "Macera", path: "/macera" } },
      { id: "pcat_b", card: { label: "Plaj", path: "/plaj", image: IMAGE } },
      { id: "pcat_c", card: { label: "ıhlamur", path: "/ihlamur" } },
    ],
  })
  vi.mocked(categoryCounts).mockResolvedValue(new Map([["pcat_a", 12]]))
})

describe("the categories' icon row view (adr/0077 §10 Ek)", () => {
  it("gives each category its picked icon, else its picture, else its initial", async () => {
    const view = await iconCategoriesView(row(), t)
    expect(view).toMatchObject({
      type: "categories",
      variant: "icons",
      title: "home.shop_categories",
      icons: {
        disc: "tint",
        phone: "scroll",
        items: [
          { label: "Macera", icon: "mountain", image: null, initial: "M" },
          { label: "Plaj", icon: null, image: IMAGE, initial: "P" },
          // An icon this build does not know reads as none
          { label: "ıhlamur", icon: null, image: null, initial: "I" },
        ],
      },
    })
    expect(categoryCounts).not.toHaveBeenCalled()
  })

  it("reads a preset's icons by handle after the ids' (id > handle > picture > initial)", async () => {
    vi.mocked(namedCategories).mockResolvedValue({
      categories: [
        {
          id: "pcat_a",
          name: "Macera",
          handle: "macera",
          description: null,
          parent_category_id: null,
        },
        { id: "pcat_b", name: "Plaj", handle: "plaj", description: null, parent_category_id: null },
        {
          id: "pcat_c",
          name: "ıhlamur",
          handle: "ihlamur",
          description: null,
          parent_category_id: null,
        },
      ],
      named: [
        { id: "pcat_a", card: { label: "Macera", path: "/macera" } },
        { id: "pcat_b", card: { label: "Plaj", path: "/plaj", image: IMAGE } },
        { id: "pcat_c", card: { label: "ıhlamur", path: "/ihlamur" } },
      ],
    })
    const view = await iconCategoriesView(
      row({
        category_icons: { pcat_a: "mountain" },
        category_icons_by_handle: { macera: "leaf", plaj: "palm", toString: "sun" } as never,
      }),
      t
    )
    expect(view).toMatchObject({
      icons: {
        items: [
          { label: "Macera", icon: "mountain" },
          { label: "Plaj", icon: "palm", image: IMAGE },
          { label: "ıhlamur", icon: null, initial: "I" },
        ],
      },
    })
  })

  it("counts only while the shop shows counts, and reads unknown steps as defaults", async () => {
    const view = await iconCategoriesView(
      row({ show_count: true, disc: "gold" as never, phone: "wrap" }),
      t
    )
    expect(view).toMatchObject({
      icons: { disc: "tint", phone: "wrap", items: [{ count: 12 }, { count: 0 }, { count: 0 }] },
    })
  })

  it("narrows to a preset's handles in their order while no id is named, a strip kept", async () => {
    const category = (id: string, handle: string) => ({
      id,
      name: handle,
      handle,
      description: null,
      parent_category_id: null,
    })
    vi.mocked(namedCategories).mockResolvedValue({
      categories: [
        category("pcat_a", "macera"),
        category("pcat_b", "plaj"),
        category("pcat_c", "x"),
      ],
      named: [
        { id: "pcat_a", card: { label: "Macera", path: "/macera" } },
        { id: "pcat_b", card: { label: "Plaj", path: "/plaj" } },
        { id: "pcat_c", card: { label: "X", path: "/x" } },
      ],
    })
    const view = await iconCategoriesView(
      row({
        category_ids: [],
        category_handles: ["plaj", "yok", "macera"],
        row_style: "strip",
      } as never),
      t
    )
    expect(view).toMatchObject({
      icons: { row_style: "strip", items: [{ label: "Plaj" }, { label: "Macera" }] },
    })
    // No handle found: every top category, as before
    const all = await iconCategoriesView(row({ category_ids: [], category_handles: ["yok"] }), t)
    expect(all).toMatchObject({ icons: { row_style: "stacked" } })
    expect((all as { icons: { items: unknown[] } }).icons.items).toHaveLength(3)
  })

  it("draws nothing with no category", async () => {
    vi.mocked(namedCategories).mockResolvedValue({ categories: [], named: [] })
    expect(await iconCategoriesView(row(), t)).toBeNull()
  })

  it("upper-cases the initial the Turkish way", () => {
    expect(initialOf(" istanbul")).toBe("İ")
    expect(initialOf("")).toBe("")
  })
})
