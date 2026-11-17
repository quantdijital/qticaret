import { describe, expect, it } from "vitest"
import {
  FOOTER_BLOCK_MAX,
  FOOTER_BLOCK_TYPES,
  FOOTER_NEWSLETTER_VARIANTS,
  FOOTER_ROWS_DEFAULTS,
  FOOTER_ROWS_LIMITS,
  FOOTER_ROWS_SETTINGS,
  FOOTER_ROWS_START,
  FOOTER_ROW_DEFAULTS,
  FOOTER_ROW_LAYOUTS,
  FOOTER_ROW_SETTINGS,
  footerRowColumns,
} from "../store/section-footer-rows.js"
import { FOOTER_COLUMNS_SETTINGS } from "../store/section-footer.js"
import { SECTION_LOOK } from "../store/section-look.js"
import { SECTION_VARIANTS, variantOf } from "../store/section-variants.js"

describe("the free rows footer (adr/0070)", () => {
  it("is a third variant: the ledger stays the default, brand columns as it was", () => {
    expect(SECTION_VARIANTS.footer_bar).toEqual(["ledger", "brand_columns", "free_rows"])
    expect(variantOf("footer_bar", "free_rows")).toBe("free_rows")
    expect(variantOf("footer_bar", undefined)).toBe("ledger")
  })

  it("splits a row into one to four columns, each split's parts its columns", () => {
    expect(FOOTER_ROW_LAYOUTS).toHaveLength(10)
    for (const layout of FOOTER_ROW_LAYOUTS) {
      expect(footerRowColumns(layout)).toBeGreaterThanOrEqual(1)
      expect(footerRowColumns(layout)).toBeLessThanOrEqual(FOOTER_ROWS_LIMITS.columns)
    }
    expect(footerRowColumns("2-1-1-1")).toBe(4)
    expect(FOOTER_ROW_LAYOUTS).toContain(FOOTER_ROW_DEFAULTS.layout)
  })

  it("names a row's steps as the look does, its defaults on their lists", () => {
    expect(FOOTER_ROW_SETTINGS.ground).toEqual(["inherit", ...SECTION_LOOK.ground])
    expect(FOOTER_ROW_SETTINGS.space).toEqual(SECTION_LOOK.space_inner)
    expect(FOOTER_ROW_SETTINGS.align).toEqual(SECTION_LOOK.align)
    for (const [setting, steps] of Object.entries(FOOTER_ROW_SETTINGS)) {
      expect(steps).toContain(FOOTER_ROW_DEFAULTS[setting as keyof typeof FOOTER_ROW_SETTINGS])
    }
    expect(FOOTER_ROW_DEFAULTS).toMatchObject({
      ground: "inherit",
      space: "medium",
      divider: false,
    })
    // The variant's own ground and marks under the brand columns' names
    expect(FOOTER_ROWS_SETTINGS).toEqual(FOOTER_COLUMNS_SETTINGS)
    expect(FOOTER_ROWS_DEFAULTS).toEqual({
      ground: "well",
      badge_style: "card",
      bottom_badges: true,
    })
  })

  it("counts every block type, none past the footer's blocks", () => {
    expect(Object.keys(FOOTER_BLOCK_MAX)).toEqual([...FOOTER_BLOCK_TYPES])
    for (const max of Object.values(FOOTER_BLOCK_MAX)) {
      expect(max).toBeGreaterThanOrEqual(1)
      expect(max).toBeLessThanOrEqual(FOOTER_ROWS_LIMITS.blocks)
    }
    expect(FOOTER_BLOCK_MAX.menu).toBe(FOOTER_ROWS_LIMITS.slots)
    expect(FOOTER_ROWS_LIMITS).toMatchObject({ rows: 6, columns: 4, perColumn: 6, blocks: 24 })
    for (const variant of FOOTER_NEWSLETTER_VARIANTS) {
      expect(SECTION_VARIANTS.newsletter).toContain(variant)
    }
  })

  it("starts from one row within its own bounds: the brand, two menus and the contact", () => {
    expect(FOOTER_ROWS_START).toHaveLength(1)
    const [row] = FOOTER_ROWS_START
    expect(row.columns).toHaveLength(footerRowColumns(row.layout))
    const blocks = row.columns.flatMap((column) => [...column.blocks])
    expect(blocks.map((block) => block.type)).toEqual(["brand", "menu", "menu", "contact"])
    const ids = [row.id, ...blocks.map((block) => block.id)]
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]{6,24}$/)
    }
  })
})
