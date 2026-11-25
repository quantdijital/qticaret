import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import {
  CATEGORY_ICONS_DEFAULTS,
  CATEGORY_ICONS_SETTINGS,
  categories,
} from "../sections/categories"
import { SECTION_ICONS } from "../sections/icons"
import { stats } from "../sections/stats"
import { TRUST_CARD_DEFAULTS, TRUST_CARD_SETTINGS, trustBadges } from "../sections/trust-badges"
import { TRUST_ICONS } from "../../../modules/platform-settings/sections/storefront"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

const CAT_A = "pcat_01KICONA000000000000000000"
const CAT_B = "pcat_01KICONB000000000000000000"
const card = (more: Record<string, unknown> = {}) => ({
  id: "guvenkart01",
  type: "trust_badges",
  variant: "card",
  ...more,
})
const row = (more: Record<string, unknown> = {}) => ({
  id: "ikonsira01",
  type: "categories",
  variant: "icons",
  category_ids: [CAT_A, CAT_B],
  ...more,
})
const figure = (value: string, label: string, more = {}) => ({ value, label, ...more })
const strip = (more: Record<string, unknown> = {}) => ({
  id: "rakamlar01",
  type: "stats",
  items: [figure("100+", "Rota"), figure("4.8", "Puan")],
  ...more,
})

const context = {
  values: {},
  images: new Map(),
  links: new Map(),
  container: {} as MedusaContainer,
} as unknown as HydrateContext

describe("the icon set (adr/0077 §10 Ek)", () => {
  it("mirrors the contract's list and starts with the trust badges' icons", () => {
    expect(SECTION_ICONS).toEqual(contract("section-icons")["SECTION_ICONS"])
    expect(SECTION_ICONS.slice(0, TRUST_ICONS.length)).toEqual([...TRUST_ICONS])
  })

  it("mirrors the card's and the icon row's settings", () => {
    const trust = contract("section-trust")
    expect(TRUST_CARD_SETTINGS).toEqual(trust["TRUST_CARD_SETTINGS"])
    expect(TRUST_CARD_DEFAULTS).toEqual(trust["TRUST_CARD_DEFAULTS"])
    const own = contract("section-categories")
    expect(CATEGORY_ICONS_SETTINGS).toEqual(own["CATEGORY_ICONS_SETTINGS"])
    expect(CATEGORY_ICONS_DEFAULTS).toEqual(own["CATEGORY_ICONS_DEFAULTS"])
  })
})

describe("the trust badges' card", () => {
  it("takes the card unlifted by default, on a page, a category page and the footer", () => {
    const doc = layoutDocument.parse({
      home: [card()],
      category: [card({ id: "guvenkart02", placement: "bottom" })],
      footer: [card({ id: "guvenkart03" })],
    })
    expect(doc.home[0]).toMatchObject({ variant: "card", lift: "off" })
    expect(doc.category[0]).toMatchObject({ variant: "card", placement: "bottom" })
    expect(doc.footer[0]).toMatchObject({ variant: "card", lift: "off" })
  })

  it("refuses a lift off its list and a lift on another variant", () => {
    expect(issues({ home: [card({ lift: "high" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [card({ variant: "lined", lift: "on" })] })).not.toEqual([])
  })

  it("prints the lift only on the card", async () => {
    expect(await hydrateSection(trustBadges.parse(card({ lift: "on" })), context)).toEqual({
      id: "guvenkart01",
      type: "trust_badges",
      variant: "card",
      lift: "on",
    })
    expect(await hydrateSection(trustBadges.parse(card({ variant: "lined" })), context)).toEqual({
      id: "guvenkart01",
      type: "trust_badges",
      variant: "lined",
    })
  })
})

describe("the categories' icon row", () => {
  it("takes a row with its default steps and no icons", () => {
    const doc = layoutDocument.parse({ home: [row()] })
    expect(doc.home[0]).toMatchObject({
      variant: "icons",
      disc: "tint",
      phone: "scroll",
      category_icons: {},
      show_count: false,
    })
  })

  it("holds each icon to the set and each key to a record id", () => {
    expect(issues({ home: [row({ category_icons: { [CAT_A]: "mountain" } })] })).toEqual([])
    expect(issues({ home: [row({ category_icons: { [CAT_A]: "rocket" } })] })).not.toEqual([])
    expect(issues({ home: [row({ category_icons: { "../x": "leaf" } })] })).not.toEqual([])
    expect(issues({ home: [row({ disc: "gold" })] })).toEqual(["storefront_layout.section_invalid"])
  })

  it("prints its settings and only the icons of the categories it names", async () => {
    const section = categories.parse(
      row({
        category_icons: { [CAT_A]: "mountain", pcat_01KGONE000000000000000000: "leaf" },
        phone: "wrap",
      })
    )
    expect(await hydrateSection(section, context)).toEqual({
      id: "ikonsira01",
      type: "categories",
      title: null,
      category_ids: [CAT_A, CAT_B],
      variant: "icons",
      disc: "tint",
      phone: "wrap",
      category_icons: { [CAT_A]: "mountain" },
    })
  })
})

describe("the icon row's icons by handle (a preset's)", () => {
  it("stays absent until written, so a row before it parses as it did", () => {
    const doc = layoutDocument.parse({ home: [row()] })
    expect(doc.home[0]).not.toHaveProperty("category_icons_by_handle")
  })

  it("holds each icon to the set, each key to a slug and the count to the items' limit", () => {
    const by = (picked: Record<string, string>) =>
      issues({ home: [row({ category_icons_by_handle: picked })] })
    expect(by({ "dag-turlari": "mountain", plaj: "palm" })).toEqual([])
    expect(by({ plaj: "rocket" })).not.toEqual([])
    expect(by({ Plaj: "palm" })).not.toEqual([])
    expect(by({ "../plaj": "palm" })).not.toEqual([])
    expect(by({ ["a".repeat(81)]: "palm" })).not.toEqual([])
    const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${String(i)}`, "leaf"]))
    expect(by(many)).not.toEqual([])
    // Only the icon row takes it
    expect(
      issues({ home: [row({ variant: "tiles", category_icons_by_handle: { plaj: "palm" } })] })
    ).not.toEqual([])
  })

  it("prints the handles' icons beside the ids' only once written", async () => {
    const written = categories.parse(
      row({ category_icons: { [CAT_A]: "mountain" }, category_icons_by_handle: { plaj: "palm" } })
    )
    expect(await hydrateSection(written, context)).toMatchObject({
      category_icons: { [CAT_A]: "mountain" },
      category_icons_by_handle: { plaj: "palm" },
    })
    const empty = categories.parse(row({ category_icons_by_handle: {} }))
    expect(await hydrateSection(empty, context)).not.toHaveProperty("category_icons_by_handle")
    expect(await hydrateSection(categories.parse(row()), context)).not.toHaveProperty(
      "category_icons_by_handle"
    )
  })
})

describe("the icon row's strip and a preset's handles", () => {
  it("prints the strip and the handles only once written, today's row as it was", async () => {
    const today = await hydrateSection(categories.parse(row()), context)
    expect(today).not.toHaveProperty("row_style")
    expect(today).not.toHaveProperty("category_handles")
    const written = categories.parse(
      row({ row_style: "strip", category_handles: ["macera", "plaj"] })
    )
    expect(await hydrateSection(written, context)).toMatchObject({
      row_style: "strip",
      category_handles: ["macera", "plaj"],
    })
  })

  it("refuses a row style off its list and a handle that is no slug", () => {
    expect(issues({ home: [row({ row_style: "wide" })] })).not.toEqual([])
    expect(issues({ home: [row({ category_handles: ["Plaj"] })] })).not.toEqual([])
  })
})

describe("the figures strip's icons", () => {
  it("leaves the icons off and a figure's icon absent until picked", () => {
    const parsed = stats.parse(strip())
    expect(parsed).toMatchObject({ icons: "off" })
    expect(parsed.items[0]).not.toHaveProperty("icon")
    expect(issues({ home: [strip({ icons: "big" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("prints a picked icon and the switch", async () => {
    const section = stats.parse(
      strip({
        icons: "on",
        items: [figure("100+", "Rota", { icon: "compass" }), figure("4.8", "Puan")],
      })
    )
    expect(await hydrateSection(section, context)).toMatchObject({
      icons: "on",
      items: [
        { value: "100+", label: "Rota", text: null, icon: "compass" },
        { value: "4.8", label: "Puan", text: null },
      ],
    })
  })
})
