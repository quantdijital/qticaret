import type { MedusaContainer } from "@medusajs/framework/types"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import { categories } from "../sections/categories"
import { SCROLLER_DEFAULTS } from "../sections/scroller"

const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

const CAT_A = "pcat_01KCAROA000000000000000000"
const row = (more: Record<string, unknown> = {}) => ({
  id: "kayankat01",
  type: "categories",
  variant: "carousel",
  category_ids: [CAT_A],
  ...more,
})

const context = {
  values: {},
  images: new Map(),
  links: new Map(),
  container: {} as MedusaContainer,
} as unknown as HydrateContext

describe("the categories' sliding cards", () => {
  it("takes the carousel with the scroller kit's defaults", () => {
    const doc = layoutDocument.parse({ home: [row()] })
    expect(doc.home[0]).toMatchObject({
      variant: "carousel",
      scroller: SCROLLER_DEFAULTS,
      show_count: false,
    })
    expect(doc.home[0]).not.toHaveProperty("category_handles")
  })

  it("holds the scroller to its lists and the handles to slugs", () => {
    expect(
      issues({ home: [row({ scroller: { desktop: "five", autoplay_step: "card" } })] })
    ).toEqual([])
    expect(issues({ home: [row({ scroller: { desktop: "ten" } })] })).not.toEqual([])
    expect(issues({ home: [row({ category_handles: ["dag-turlari"] })] })).toEqual([])
    expect(issues({ home: [row({ category_handles: ["Plaj"] })] })).not.toEqual([])
    // The scroller is the carousel's own: today's tiles take none
    expect(issues({ home: [row({ variant: "tiles", scroller: {} })] })).not.toEqual([])
  })

  it("prints its scroller, and a preset's handles only once written", async () => {
    const plain = categories.parse(row({ show_count: true, scroller: { desktop: "five" } }))
    expect(await hydrateSection(plain, context)).toEqual({
      id: "kayankat01",
      type: "categories",
      title: null,
      category_ids: [CAT_A],
      show_count: true,
      variant: "carousel",
      scroller: { ...SCROLLER_DEFAULTS, desktop: "five" },
    })
    const handled = categories.parse(row({ category_ids: [], category_handles: ["macera"] }))
    expect(await hydrateSection(handled, context)).toMatchObject({
      category_handles: ["macera"],
    })
    const empty = categories.parse(row({ category_handles: [] }))
    expect(await hydrateSection(empty, context)).not.toHaveProperty("category_handles")
  })
})
