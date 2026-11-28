import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { recordsOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import { resolvePreset } from "../presets/resolve"
import {
  DEPARTURES_DEFAULTS,
  DEPARTURES_LIMITS,
  DEPARTURES_SETTINGS,
  departures,
} from "../sections/departures"
import { SECTION_REQUIRES, withoutTypesOff } from "../sections/requires"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = jest.requireActual<Record<string, unknown>>(
  path.resolve(__dirname, "../../../../../../packages/types/src/store/section-departures.ts")
)

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const PAGE = "cnt_01KTOURS0000000000000000"
const upcoming = (more: Record<string, unknown> = {}) => ({
  id: "kalkislar01",
  type: "departures",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("upcoming departures (adr/0077 §10)", () => {
  it("takes a new one with every dated product, six rows and the list, home and content page", () => {
    const doc = layoutDocument.parse({
      home: [upcoming()],
      pages: [{ page_id: PAGE, sections: [upcoming({ id: "kalkislar02" })] }],
    })

    expect(doc.home[0]).toEqual({
      ...upcoming(),
      ...ALWAYS,
      title: null,
      intro: null,
      source: { kind: "all" },
      limit: 6,
      layout: "list",
      phone: "stack",
    })
    expect(doc.pages[0]?.sections[0]).toMatchObject({ type: "departures", layout: "list" })
  })

  it("takes a category's or a collection's, three to twelve rows, the cards", () => {
    const category = { kind: "category", category_id: "pcat_01KTUR000000000000000000" }
    const collection = { kind: "collection", collection_id: "pcol_01KYAZ000000000000000000" }
    expect(issues({ home: [upcoming({ source: category, limit: 3, layout: "cards" })] })).toEqual(
      []
    )
    expect(issues({ home: [upcoming({ source: collection, limit: 12 })] })).toEqual([])
    expect(issues({ home: [upcoming({ limit: 2 })] })).not.toEqual([])
    expect(issues({ home: [upcoming({ limit: 13 })] })).not.toEqual([])
    expect(issues({ home: [upcoming({ limit: 4.5 })] })).not.toEqual([])
  })

  it("refuses a source off its list, a stray field, a layout off its list, a long intro", () => {
    expect(
      issues({ home: [upcoming({ source: { kind: "manual", product_ids: [] } })] })
    ).not.toEqual([])
    expect(issues({ home: [upcoming({ source: { kind: "category" } })] })).not.toEqual([])
    expect(issues({ home: [upcoming({ price: 100 })] })).not.toEqual([])
    expect(issues({ home: [upcoming({ layout: "grid" })] })).toContain(
      "storefront_layout.section_invalid"
    )
    expect(
      issues({ home: [upcoming({ intro: "x".repeat(DEPARTURES_LIMITS.intro + 1) })] })
    ).not.toEqual([])
  })

  it("is not offered on a product or a category page", () => {
    expect(issues({ product: [upcoming()] })).toContain("storefront_layout.section_invalid")
    expect(issues({ category: [upcoming({ placement: "top" })] })).toContain(
      "storefront_layout.section_invalid"
    )
  })

  it("mirrors the contract's lists, and needs dated products' flag", () => {
    expect(DEPARTURES_SETTINGS).toEqual(contract["DEPARTURES_SETTINGS"])
    expect(DEPARTURES_DEFAULTS).toEqual(contract["DEPARTURES_DEFAULTS"])
    expect(DEPARTURES_LIMITS).toEqual(contract["DEPARTURES_LIMITS"])
    expect(SECTION_REQUIRES["departures"]).toBe("catalog.booking")
  })

  it("names its category or collection as a record the design holds, none for every product", () => {
    const of = (source: unknown) => recordsOf(departures.parse(upcoming({ source })))
    expect(of({ kind: "category", category_id: "pcat_a" })).toEqual([
      { kind: "category", target: "pcat_a" },
    ])
    expect(of({ kind: "collection", collection_id: "pcol_a" })).toEqual([
      { kind: "collection", target: "pcol_a" },
    ])
    expect(of({ kind: "all" })).toEqual([])
  })

  it("is given to the storefront with the shop's words filled and its source as saved", async () => {
    const section = departures.parse(
      upcoming({
        title: "Yakında yola çıkıyoruz",
        intro: "{mağaza_adı} turlarının yakın tarihleri",
        source: { kind: "category", category_id: "pcat_a" },
        limit: 4,
        layout: "cards",
      })
    )
    const context = {
      values: { mağaza_adı: "Rota" },
      images: new Map(),
      links: new Map(),
      container: {} as MedusaContainer,
    } as unknown as HydrateContext

    expect(await hydrateSection(section, context)).toMatchObject({
      id: "kalkislar01",
      type: "departures",
      title: "Yakında yola çıkıyoruz",
      intro: "Rota turlarının yakın tarihleri",
      source: { kind: "category", category_id: "pcat_a" },
      limit: 4,
      layout: "cards",
    })
  })

  it("swipes the cards on a phone only when asked; the default and the list say nothing", async () => {
    const context = {
      values: {},
      images: new Map(),
      links: new Map(),
      container: {} as MedusaContainer,
    } as unknown as HydrateContext
    const of = (fields: Record<string, unknown>) =>
      hydrateSection(departures.parse(upcoming(fields)), context)

    expect(issues({ home: [upcoming({ phone: "scroll" })] })).toEqual([])
    expect(issues({ home: [upcoming({ phone: "slide" })] })).toContain(
      "storefront_layout.section_invalid"
    )
    expect(await of({ layout: "cards", phone: "scroll" })).toMatchObject({ phone: "scroll" })
    expect(await of({ layout: "cards" })).not.toHaveProperty("phone")
    expect(await of({ layout: "list", phone: "scroll" })).not.toHaveProperty("phone")
  })

  it("is left out of the storefront's design while dated products are off", () => {
    const sections = [{ id: "acilis", type: "hero" }, upcoming()]
    const off = new Map([["departures", "catalog.booking"]])

    expect(withoutTypesOff(sections, off).map((each) => each.id)).toEqual(["acilis"])
    expect(withoutTypesOff(sections, new Map())).toHaveLength(2)
  })

  it("is dropped from a ready-made look as feature_off while dated products are off", () => {
    const section = { ...upcoming(), visible: true, starts_at: null, ends_at: null }
    const resolved = resolvePreset({ home: [section], pages: [] }, null, {
      records: new Map(),
      links: new Map(),
      images: new Map(),
      types_off: new Map([["departures", "catalog.booking"]]),
    })

    expect(resolved.groups.home).toEqual([])
    expect(resolved.skipped).toEqual([
      {
        where: "home.kalkislar01",
        ref: "departures",
        reason: "feature_off",
        flag: "catalog.booking",
      },
    ])
  })
})
