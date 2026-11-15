import { describe, expect, it, vi } from "vitest"
import type { StoreCategory, StoreMainSections } from "@qticaret/types"
import type { CategoryCardView } from "@qticaret/ui"
import { cardsView, childIds, linkedCards } from "../category-cards"
import { footerBarOf } from "../main-sections"

vi.mock("server-only", () => ({}))

const t = (key: string) => key
const category = (id: string, parent: string | null, rank = 0): StoreCategory =>
  ({ id, name: `Ad ${id}`, handle: id, parent_category_id: parent, rank }) as StoreCategory

const ALL = [
  category("top", null),
  category("c1", "top", 1),
  category("c2", "top", 2),
  category("c3", "top", 3),
  category("hidden", "top", 4),
  category("empty", "top", 5),
  category("bare", null),
]
const PATHS = { c1: "/c1", c2: "/c2", c3: "/c3", empty: "/empty" }
const IMAGE = {
  src: "/top.webp",
  alt: "Ad top",
  width: 10,
  height: 10,
  sources: { avif: null, webp: null },
}
const named: { id: string; card: CategoryCardView }[] = [
  { id: "top", card: { label: "Ad top", path: "/top", image: IMAGE } },
  { id: "bare", card: { label: "Ad bare", path: "/bare" } },
]
const SETTINGS = { links: 2, image_position: "side" as const, show_count: true }

describe("the linked category cards (adr/0049 Ek 2026-11-15)", () => {
  it("lists the first live subcategories with products, a see-all link and the count", () => {
    const counts = new Map([
      ["top", 12],
      ["c1", 4],
      ["c2", 0],
      ["c3", 8],
      ["empty", 0],
    ])
    const [top, bare] = linkedCards(named, ALL, PATHS, counts, SETTINGS, t)

    expect(top).toEqual({
      label: "Ad top",
      path: "/top",
      image: IMAGE,
      count: 12,
      children: [
        { label: "Ad c1", path: "/c1" },
        { label: "Ad c3", path: "/c3" },
      ],
      all: { label: "categories.see_all", path: "/top" },
    })
    // No shown subcategory: no see-all link, just the card
    expect(bare).toEqual({ label: "Ad bare", path: "/bare", children: [], all: null })
  })

  it("shows every live subcategory when the backend did not count, and no picture or count on request", () => {
    const [top] = linkedCards(
      named,
      ALL,
      PATHS,
      new Map(),
      { links: 8, image_position: "none", show_count: false },
      t
    )

    expect(top?.image).toBeUndefined()
    expect(top?.count).toBeUndefined()
    expect(top?.children.map((child) => child.path)).toEqual(["/c1", "/c2", "/c3", "/empty"])
  })

  it("gives no links at zero, and asks the paths of every card's subcategories at once", () => {
    const [top] = linkedCards(named, ALL, PATHS, new Map(), { ...SETTINGS, links: 0 }, t)
    expect(top?.children).toEqual([])
    expect(top?.all).toBeNull()
    expect(childIds(named, ALL)).toEqual(["c1", "c2", "c3", "hidden", "empty"])
    expect(cardsView({ columns: 4, image_position: "top", frame: "plain" }, [])).toEqual({
      columns: 4,
      imagePosition: "top",
      frame: "plain",
      cards: [],
    })
  })
})

const footer = (more: Record<string, unknown>) =>
  ({
    footer_bar: { id: "mainfooter", type: "footer_bar", variant: "ledger", ...more },
  }) as unknown as StoreMainSections

describe("the footer bar's own settings (adr/0049 Ek 2026-11-15)", () => {
  it("draws the footer as before from a backend before them or with the defaults", () => {
    expect(footerBarOf(undefined, t)).toEqual({ id: "mainfooter", variant: "ledger" })
    expect(footerBarOf(footer({}), t)).toEqual({ id: "mainfooter", variant: "ledger" })
  })

  it("names the ways to pay in the shop's order and places the button", () => {
    expect(
      footerBarOf(
        footer({
          social: "icons",
          payment_badges: ["troy", "visa"],
          back_to_top: true,
          back_to_top_side: "left",
          back_to_top_shape: "square",
          back_to_top_mobile: false,
        }),
        t
      )
    ).toEqual({
      id: "mainfooter",
      variant: "ledger",
      social: "icons",
      paymentBadges: [
        { key: "troy", label: "marks.troy" },
        { key: "visa", label: "marks.visa" },
      ],
      backToTop: { side: "left", shape: "square", mobile: false },
    })
  })

  it("reads what this build does not know forgivingly", () => {
    expect(
      footerBarOf(
        footer({
          social: "logos",
          payment_badges: ["paypal", "visa", "visa"],
          back_to_top: true,
          back_to_top_side: "middle",
        }),
        t
      )
    ).toEqual({
      id: "mainfooter",
      variant: "ledger",
      paymentBadges: [{ key: "visa", label: "marks.visa" }],
      backToTop: { side: "right", shape: "round", mobile: true },
    })
  })
})
