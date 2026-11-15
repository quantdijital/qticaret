import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { layoutDocument } from "../../../lib/storefront/layout"
import type { BodySection } from "../../../lib/storefront/layout"
import { SEARCH_INDEX_MODULE } from "../../../modules/search-index"
import type { ListingPlan } from "../../../modules/search-index/types"
import { checkLayout } from "../layout-check"
import { liveRecords } from "../layout-live"
import { resolveLinks } from "../menu-links"
import { bandPicks } from "../price-bands"

// The links' resolver as the live filter asks it: only the shown category is live
jest.mock("../menu-links", () => {
  const actual = jest.requireActual<Record<string, unknown>>("../menu-links")
  return {
    ...actual,
    resolveLinks: jest.fn((_container: unknown, links: { id: string }[]) =>
      Promise.resolve(
        new Map(links.map((link) => [link.id, { broken: link.id !== "category:pcat_kamp" }]))
      )
    ),
  }
})

/**
 * A price band's own category (adr/0049, dated line 2026-11-15 on the
 * note "Katalog ana sayfası"): checked as other sections' categories are,
 * a band whose category is hidden left out, and its products picked from
 * the category's shown subtree.
 */

const strip = (bands: unknown[], thumbs = 2): BodySection => {
  const [section] = layoutDocument.parse({
    home: [{ id: "fiyatbant1", type: "price_bands", bands, thumbs }],
  }).home
  if (section?.type !== "price_bands") {
    throw new Error("no bands")
  }
  return section
}

const CATEGORIES = [
  { id: "pcat_kamp", mpath: "pcat_kamp", is_active: true, is_internal: false },
  { id: "pcat_balta", mpath: "pcat_kamp.pcat_balta", is_active: true, is_internal: false },
  // Hidden under a shown one: its products are not the band's
  { id: "pcat_gizli", mpath: "pcat_kamp.pcat_gizli", is_active: false, is_internal: false },
  { id: "pcat_kilic", mpath: "pcat_kilic", is_active: true, is_internal: false },
]

/**
 * A container whose query answers the lira's region and the categories
 * (`more`: the shop's other ones, hidden), and whose index lists.
 */
function container(more: readonly string[] = []) {
  const plans: ListingPlan[] = []
  const rows = [
    ...CATEGORIES,
    ...more.map((id) => ({ id, mpath: id, is_active: false, is_internal: false })),
  ]
  const graph = jest.fn(({ entity, filters }: { entity: string; filters?: { id?: string[] } }) => {
    if (entity === "region") {
      return Promise.resolve({ data: [{ id: "reg_try", currency_code: "try" }] })
    }
    if (entity === "product_category") {
      const ids = filters?.id
      return Promise.resolve({ data: ids ? rows.filter((row) => ids.includes(row.id)) : rows })
    }
    return Promise.resolve({ data: [] })
  })
  const index = {
    listing: jest.fn((plan: ListingPlan) => {
      plans.push(plan)
      // Each band's products, by its scope: a category's own, else the whole catalogue's
      const ids = plan.scope.category_ids
        ? ["prod_kamp", "prod_ortak"]
        : ["prod_ortak", "prod_ucuz"]
      return Promise.resolve({ ids })
    }),
  }
  const resolve = (key: string) => {
    if (key === ContainerRegistrationKeys.QUERY) {
      return { graph }
    }
    if (key === SEARCH_INDEX_MODULE) {
      return index
    }
    throw new Error(`unexpected ${key}`)
  }
  return { container: { resolve } as never, plans, graph }
}

describe("a price band's category", () => {
  it("is checked on saving like every section's category: one the shop has not, refused", async () => {
    const doc = layoutDocument.parse({
      home: [
        {
          id: "fiyatbant1",
          type: "price_bands",
          bands: [
            { label: "₺500 altı", max: 500 },
            { label: "Kamp", max: null, category_id: "pcat_yok" },
          ],
        },
      ],
    })

    await expect(checkLayout(container().container, doc)).rejects.toMatchObject({
      safeMessage: "storefront_layout.target_unknown",
    })
    // A hidden category exists: saved, then left out on the storefront (as a rail's)
    const kept = container(["pcat_yok"])
    await expect(checkLayout(kept.container, doc)).resolves.toEqual([])
  })

  it("leaves a band whose category is not live out of its strip, a strip of none out", async () => {
    const filter = await liveRecords(container().container, [
      strip([
        { label: "₺500 altı", max: 500 },
        { label: "Kamp", max: null, category_id: "pcat_kamp" },
        { label: "Gizli", max: null, category_id: "pcat_gizli" },
      ]),
    ])
    const [kept] = filter([
      strip([
        { label: "₺500 altı", max: 500 },
        { label: "Kamp", max: null, category_id: "pcat_kamp" },
        { label: "Gizli", max: null, category_id: "pcat_gizli" },
      ]),
    ])

    expect(kept?.type === "price_bands" && kept.bands.map((band) => band.label)).toEqual([
      "₺500 altı",
      "Kamp",
    ])
    expect(
      filter([
        strip([
          { label: "Gizli", max: null, category_id: "pcat_gizli" },
          { label: "Silinmiş", max: 900, category_id: "pcat_yok" },
        ]),
      ])
    ).toEqual([])
    // A strip of price bands asks nothing
    const asked = jest.mocked(resolveLinks).mock.calls.length
    const priced = strip([
      { label: "A", max: 1 },
      { label: "B", max: null },
    ])
    expect((await liveRecords(container().container, [priced]))([priced])).toEqual([priced])
    expect(jest.mocked(resolveLinks).mock.calls).toHaveLength(asked)
  })

  it("picks a category band's products in its shown subtree, by price when it has a bound", async () => {
    const { container: c, plans } = container()
    const section = strip([
      { label: "₺500 altı", max: 500 },
      { label: "Kamp", max: null, category_id: "pcat_kamp" },
      { label: "Kamp, ₺900'e kadar", max: 900, category_id: "pcat_kamp" },
      { label: "Üstü", max: null },
    ])

    const picks = await bandPicks(c, [section], ["sc_1"])

    expect(plans.map((plan) => [plan.scope, plan.price.min, plan.price.max])).toEqual([
      [{}, null, 500],
      [{ category_ids: ["pcat_kamp", "pcat_balta"] }, null, null],
      [{ category_ids: ["pcat_kamp", "pcat_balta"] }, null, 900],
      [{}, 501, null],
    ])
    expect(plans.every((plan) => plan.price.key === "reg_try:try")).toBe(true)
    // In the bands' order, a product shown before never again
    expect(picks.get("fiyatbant1")).toEqual([["prod_ortak", "prod_ucuz"], ["prod_kamp"], [], []])
  })

  it("reads no categories for a strip of price bands", async () => {
    const { container: c, plans, graph } = container()
    await bandPicks(
      c,
      [
        strip([
          { label: "A", max: 500 },
          { label: "B", max: null },
        ]),
      ],
      null
    )

    expect(plans.map((plan) => plan.scope)).toEqual([{}, {}])
    expect(graph.mock.calls.map(([{ entity }]) => entity)).toEqual(["region"])
  })
})
