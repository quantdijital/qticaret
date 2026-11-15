import path from "node:path"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import {
  CATEGORY_CARD_DEFAULTS,
  CATEGORY_CARD_LIMITS,
  CATEGORY_CARD_SETTINGS,
  categories,
} from "../sections/categories"
import { FOOTER_BAR_DEFAULTS, FOOTER_BAR_SETTINGS, PAYMENT_BADGES } from "../sections/footer-bar"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const LEFT = { layout: "left", sticky: true } as const
const cards = (more: Record<string, unknown> = {}) => ({
  id: "kategori01",
  type: "categories",
  ...more,
})
const footer = (more: Record<string, unknown> = {}) => ({
  id: "mainfooter",
  type: "footer_bar",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const at = { values: {}, images: new Map(), links: new Map() } as unknown as HydrateContext

describe("the category cards' linked variant (adr/0049 Ek 2026-11-15)", () => {
  it("reads a section saved before variants as today's tiles, its fields untouched", () => {
    const [section] = layoutDocument.parse({
      home: [cards({ title: "Reyonlar", show_count: true })],
    }).home

    expect(section).toEqual({
      ...cards(),
      ...ALWAYS,
      variant: "tiles",
      title: "Reyonlar",
      category_ids: [],
      show_count: true,
      more: null,
    })
  })

  it("fills the linked cards' settings with their defaults, keeping what was saved", () => {
    const [filled] = layoutDocument.parse({ home: [cards({ variant: "linked" })] }).home
    const [kept] = layoutDocument.parse({
      home: [cards({ variant: "linked", columns: 4, links: 0, frame: "plain" })],
    }).home

    expect(filled).toMatchObject({ variant: "linked", ...CATEGORY_CARD_DEFAULTS })
    expect(kept).toMatchObject({ columns: 4, links: 0, frame: "plain", image_position: "side" })
  })

  it("refuses the linked settings on today's tiles and steps off their lists", () => {
    const linked = (more: Record<string, unknown>) => ({
      home: [cards({ variant: "linked", ...more })],
    })

    expect(issues({ home: [cards({ variant: "tiles", columns: 3 })] })).toHaveLength(1)
    expect(issues(linked({ columns: 5 }))).toEqual(["storefront_layout.section_invalid"])
    expect(issues(linked({ image_position: "below" }))).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues(linked({ frame: "shadow" }))).toEqual(["storefront_layout.section_invalid"])
    expect(issues(linked({ links: 9 }))).toHaveLength(1)
    expect(issues(linked({ links: -1 }))).toHaveLength(1)
    expect(issues(linked({ links: 2.5 }))).toHaveLength(1)
    expect(issues(linked({ columns: 2, image_position: "none", links: 8 }))).toEqual([])
  })

  it("reads a stored variant off the list as today's tiles, keeping the common fields", () => {
    const doc = readStoredLayout({
      home: [cards({ ...ALWAYS, variant: "bento", title: "Reyonlar", columns: 4, links: 2 })],
    })

    expect(doc.home[0]).toEqual({
      ...cards(),
      ...ALWAYS,
      variant: "tiles",
      title: "Reyonlar",
      category_ids: [],
      show_count: false,
      more: null,
    })
  })

  it("prints today's tiles without a variant, the linked cards with their settings", async () => {
    const tiles = categories.parse(cards(ALWAYS))
    const linked = categories.parse(cards({ ...ALWAYS, variant: "linked", columns: 2 }))

    expect(await hydrateSection(tiles, at)).toEqual({
      id: "kategori01",
      type: "categories",
      title: null,
      category_ids: [],
    })
    expect(await hydrateSection(linked, at)).toEqual({
      id: "kategori01",
      type: "categories",
      title: null,
      category_ids: [],
      variant: "linked",
      columns: 2,
      image_position: "side",
      frame: "lined",
      links: 5,
    })
  })

  it("mirrors the contract's settings, limits and defaults", () => {
    const own = contract("section-categories")
    expect(CATEGORY_CARD_SETTINGS).toEqual(own["CATEGORY_CARD_SETTINGS"])
    expect(CATEGORY_CARD_LIMITS).toEqual(own["CATEGORY_CARD_LIMITS"])
    expect(CATEGORY_CARD_DEFAULTS).toEqual(own["CATEGORY_CARD_DEFAULTS"])
  })
})

describe("the footer bar's own settings (adr/0049 Ek 2026-11-15)", () => {
  it("reads a footer saved before them with the defaults, and prints it as before", () => {
    const doc = withMainSections(layoutDocument.parse({ footer: [footer()] }), LEFT)

    // A main section always shows: no screens of its own
    expect(doc.footer[0]).toEqual({
      ...footer(),
      visible: true,
      starts_at: null,
      ends_at: null,
      variant: "ledger",
      ...FOOTER_BAR_DEFAULTS,
    })
    expect(mainSectionsOf(doc).footer_bar).toEqual({
      id: "mainfooter",
      type: "footer_bar",
      variant: "ledger",
    })
  })

  it("keeps what a partial save holds, and prints only what the shop changed", () => {
    const doc = withMainSections(
      layoutDocument.parse({
        footer: [footer({ social: "icons", payment_badges: ["troy", "visa"], back_to_top: true })],
      }),
      LEFT
    )

    expect(doc.footer[0]).toMatchObject({
      social: "icons",
      payment_badges: ["troy", "visa"],
      back_to_top: true,
      back_to_top_side: "right",
      back_to_top_mobile: true,
    })
    expect(mainSectionsOf(doc).footer_bar).toEqual({
      id: "mainfooter",
      type: "footer_bar",
      variant: "ledger",
      social: "icons",
      payment_badges: ["troy", "visa"],
      back_to_top: true,
      back_to_top_side: "right",
      back_to_top_shape: "round",
      back_to_top_mobile: true,
    })
  })

  it("leaves the button's place out while it is off", () => {
    const doc = withMainSections(
      layoutDocument.parse({ footer: [footer({ back_to_top_side: "left" })] }),
      LEFT
    )
    expect(mainSectionsOf(doc).footer_bar).toEqual({
      id: "mainfooter",
      type: "footer_bar",
      variant: "ledger",
    })
  })

  it("refuses a way to pay off the list or twice, and steps off their lists", () => {
    const invalid = ["storefront_layout.section_invalid"]
    expect(issues({ footer: [footer({ payment_badges: ["paypal"] })] })).toEqual(invalid)
    expect(issues({ footer: [footer({ payment_badges: ["visa", "visa"] })] })).toEqual(invalid)
    expect(issues({ footer: [footer({ social: "logos" })] })).toEqual(invalid)
    expect(issues({ footer: [footer({ back_to_top_shape: "pill" })] })).toEqual(invalid)
    expect(issues({ footer: [footer({ back_to_top: "yes" })] })).toHaveLength(1)
    expect(issues({ footer: [footer({ payment_badges: [...PAYMENT_BADGES] })] })).toEqual([])
  })

  it("mirrors the contract's lists and defaults", () => {
    const own = contract("section-footer")
    expect(FOOTER_BAR_SETTINGS).toEqual(own["FOOTER_BAR_SETTINGS"])
    expect(PAYMENT_BADGES).toEqual(own["PAYMENT_BADGES"])
    expect(FOOTER_BAR_DEFAULTS).toEqual(own["FOOTER_BAR_DEFAULTS"])
  })
})
