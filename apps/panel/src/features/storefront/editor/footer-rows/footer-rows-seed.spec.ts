import { describe, expect, it } from "vitest"
import { FOOTER_BAR_DEFAULTS, FOOTER_BLOCK_TYPES } from "@qticaret/types"
import type {
  FooterBarSection,
  FooterNewsletter,
  FooterRow,
  FooterRowsSection,
  FooterSection,
} from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { newBlock, seedFooter, seedRows } from "./footer-rows-seed"

const ledger = {
  id: "mainfooter",
  type: "footer_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "ledger",
  ...FOOTER_BAR_DEFAULTS,
  payment_badges: [],
} as FooterBarSection

const columns = (about: string | null = "Since 1990") =>
  ({ ...switchVariant(ledger, "brand_columns"), about }) as FooterBarSection

const box = {
  id: "news",
  type: "newsletter",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "split",
  title: "Join us",
  text: "Ten percent off",
  description: "Monthly",
} as FooterNewsletter

let counter = 0
const nextId = () => `id${++counter}`

/** Each row's columns as block types. */
const types = (rows: readonly FooterRow[]) =>
  rows.map((row) => row.columns.map((column) => column.blocks.map((block) => block.type)))

describe("the free rows footer's starting point (adr/0070 §2.4)", () => {
  it("has a new block of every type, shown on every device", () => {
    for (const type of FOOTER_BLOCK_TYPES) {
      const block = newBlock(type, "x")
      expect(block).toMatchObject({ id: "x", type, visible: true, device: "all" })
    }
  })

  it("starts the ledger with its brand, two menus and the contact in one row", () => {
    const rows = seedRows(ledger, null, 5, nextId)
    expect(types(rows)).toEqual([[["brand"], ["menu"], ["menu"], ["contact"]]])
    expect(rows[0]?.layout).toBe("2-1-1-1")
    const slots = rows[0]?.columns.flatMap((column) =>
      column.blocks.flatMap((block) => (block.type === "menu" ? [block.slot] : []))
    )
    expect(slots).toEqual([1, 2])
  })

  it("puts as many menus as the shop has, no more", () => {
    expect(types(seedRows(ledger, null, 0, nextId))).toEqual([[["brand"], ["contact"]]])
  })

  it("carries the brand columns' line and strip: the box and the contact above", () => {
    const rows = seedRows(columns(), box, 3, nextId)
    expect(types(rows)).toEqual([
      [["newsletter"], ["contact"]],
      [["brand"], ["menu"], ["menu"], ["menu"]],
    ])
    expect(rows[0]?.layout).toBe("1-1")
    const brand = rows[1]?.columns[0]?.blocks[0]
    expect(brand).toMatchObject({ type: "brand", about: "Since 1990", social: true })
    const news = rows[0]?.columns[0]?.blocks[0]
    // a band variant does not fit a column; the box's words move with it
    expect(news).toMatchObject({ title: "Join us", text: "Ten percent off", variant: "standard" })
  })

  it("gives the group's box a row of its own above the ledger's", () => {
    const rows = seedRows(ledger, box, 2, nextId)
    expect(types(rows)).toEqual([[["newsletter"]], [["brand"], ["menu"], ["menu"], ["contact"]]])
  })

  it("takes the newsletter section out of the group in the same step", () => {
    const group: FooterSection[] = [box, columns()]
    const seeded = seedFooter(group, 2, nextId)
    expect(seeded).toHaveLength(1)
    const footer = seeded[0] as FooterRowsSection
    expect(footer).toMatchObject({ id: "mainfooter", type: "footer_bar", variant: "free_rows" })
    expect(footer.ground).toBe((columns() as { ground: string }).ground)
    expect(footer.rows.length).toBeGreaterThan(0)
  })

  it("leaves a footer already in free rows as it was", () => {
    const once = seedFooter([ledger], 1, nextId)
    const again = seedFooter(once, 1, nextId)
    expect(again).toEqual(once)
  })
})
