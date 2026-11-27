import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreCategoriesCarousel, StoreCategoriesSection } from "@qticaret/types"
import { SCROLLER_DEFAULTS } from "@qticaret/types/section-scroller"
import { allCategories } from "@/lib/store-api/requests"
import { withCounts } from "../catalog"
import { carouselCategoriesView, carouselIds } from "../category-carousel"
import { picturedCategories } from "../category-tiles"
import { namedCategories } from "../section-data"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/store-api/requests", () => ({ allCategories: vi.fn() }))
vi.mock("../catalog", () => ({ withCounts: vi.fn() }))
vi.mock("../category-tiles", () => ({ picturedCategories: vi.fn() }))
vi.mock("../section-data", () => ({ namedCategories: vi.fn() }))
vi.mock("../layout", () => ({ layoutLink: () => null }))

const t = (key: string) => key
const CARD = { label: "Macera", path: "/macera" }

const row = (
  over: Partial<StoreCategoriesCarousel & StoreCategoriesSection> = {}
): StoreCategoriesSection & StoreCategoriesCarousel => ({
  id: "kayankat01",
  type: "categories",
  title: null,
  category_ids: ["pcat_a"],
  variant: "carousel",
  ...over,
})

beforeEach(() => {
  vi.mocked(picturedCategories).mockResolvedValue([{ id: "pcat_a", card: CARD }])
  vi.mocked(namedCategories).mockResolvedValue({
    categories: [],
    named: [{ id: "pcat_a", card: CARD }],
  })
  vi.mocked(withCounts).mockImplementation((cards, show) =>
    Promise.resolve(cards.map(({ card }) => (show ? { ...card, count: 3 } : card)))
  )
  vi.mocked(allCategories).mockResolvedValue([
    { id: "pcat_a", handle: "macera" },
    { id: "pcat_b", handle: "plaj" },
  ] as never)
})

describe("the categories' sliding cards view", () => {
  it("gives the tiles' cards and the scroller kit's settings read forgivingly", async () => {
    const view = await carouselCategoriesView(
      row({ scroller: { ...SCROLLER_DEFAULTS, desktop: "ten" as never, autoplay_step: "card" } }),
      t,
      true
    )
    expect(view).toEqual({
      id: "kayankat01",
      type: "categories",
      title: "home.shop_categories",
      categories: [CARD],
      variant: "carousel",
      scroller: { ...SCROLLER_DEFAULTS, autoplay_step: "card" },
    })
    // A product's photo stands in on the home page only, as the tiles'
    expect(picturedCategories).toHaveBeenCalledWith(["pcat_a"])
    expect(allCategories).not.toHaveBeenCalled()
  })

  it("counts the cards only while the shop shows counts, and draws none without a category", async () => {
    const counted = await carouselCategoriesView(row({ show_count: true }), t, false)
    expect(counted).toMatchObject({ categories: [{ ...CARD, count: 3 }] })
    expect(namedCategories).toHaveBeenCalledWith(["pcat_a"])
    vi.mocked(namedCategories).mockResolvedValue({ categories: [], named: [] })
    expect(await carouselCategoriesView(row(), t, false)).toBeNull()
  })

  it("reads a preset's handles in order while no id is named, skipping the shop's missing ones", async () => {
    await carouselCategoriesView(
      row({ category_ids: [], category_handles: ["plaj", "yok", "macera"] }),
      t,
      true
    )
    expect(picturedCategories).toHaveBeenCalledWith(["pcat_b", "pcat_a"])
    const all = [
      { id: "pcat_a", handle: "macera" },
      { id: "pcat_b", handle: "plaj" },
    ]
    // Named ids win over the handles; no handle found reads as the top ones
    expect(carouselIds({ category_ids: ["pcat_x"], category_handles: ["plaj"] }, all)).toEqual([
      "pcat_x",
    ])
    expect(carouselIds({ category_ids: [], category_handles: ["yok"] }, all)).toEqual([])
  })
})
