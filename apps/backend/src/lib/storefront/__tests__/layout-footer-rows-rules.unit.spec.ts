import path from "node:path"
import { FOOTER_DOC_LIMITS } from "../../content"
import { layoutDocument } from "../layout"
import * as blocks from "../sections/footer-blocks"
import * as rows from "../sections/footer-rows"
import { NEWSLETTER_LIMITS } from "../sections/newsletter"
import { SECTION_VARIANTS } from "../sections/variants"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

type Fields = Record<string, unknown>
const footer = (more: Fields = {}) => ({
  id: "mainfooter",
  type: "footer_bar",
  variant: "free_rows",
  ...more,
})
const issues = (document: unknown) =>
  layoutDocument.safeParse(document).error?.issues.map((issue) => issue.message) ?? []

describe("a free rows footer beside its group's newsletter box (adr/0070 §2, §4)", () => {
  const news = { id: "newsblock1", type: "newsletter" }
  const row = (list: unknown[]) => [{ id: "rowone001", layout: "1", columns: [{ blocks: list }] }]
  const box = (more: Fields = {}) => ({ id: "footernews", type: "newsletter", ...more })

  it("refuses a newsletter block while a visible newsletter section stands in the group", () => {
    const twice = ["storefront_layout.footer_newsletter_twice"]
    expect(issues({ footer: [footer({ rows: row([news]) }), box()] })).toEqual(twice)
    expect(
      issues({ footer: [footer({ rows: row([{ ...news, visible: false }]) }), box()] })
    ).toEqual(twice)
    expect(issues({ footer: [footer({ rows: row([news]) }), box({ visible: false })] })).toEqual([])
    expect(issues({ footer: [footer({ rows: row([news]) })] })).toEqual([])
    expect(issues({ footer: [footer({ rows: row([]) }), box({ variant: "split" })] })).toEqual([])
  })

  it("refuses a visible column box there: its place is a block", () => {
    const column = box({ variant: "in_footer" })
    expect(issues({ footer: [footer({ rows: row([]) }), column] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ footer: [footer({ rows: row([]) }), { ...column, visible: false }] })).toEqual(
      []
    )
    expect(issues({ footer: [footer({ variant: "brand_columns" }), column] })).toEqual([])
    expect(issues({ footer: [{ id: "mainfooter", type: "footer_bar" }, column] })).toEqual([])
  })
})

describe("the free rows footer's mirror of the contract", () => {
  const own = contract("section-footer-rows")

  it("keeps every list, limit and default equal", () => {
    for (const name of [
      "FOOTER_ROW_LAYOUTS",
      "FOOTER_ROW_SETTINGS",
      "FOOTER_ROW_DEFAULTS",
      "FOOTER_ROWS_SETTINGS",
      "FOOTER_ROWS_DEFAULTS",
    ] as const) {
      expect(rows[name]).toEqual(own[name])
    }
    for (const name of [
      "FOOTER_BLOCK_TYPES",
      "FOOTER_BLOCK_MAX",
      "FOOTER_ROWS_LIMITS",
      "FOOTER_NEWSLETTER_VARIANTS",
      "FOOTER_IMAGE_WIDTHS",
      "FOOTER_TRUST_LAYOUTS",
      "FOOTER_TRUST_LIMIT",
      "FOOTER_APP_HOSTS",
    ] as const) {
      expect(blocks[name]).toEqual(own[name])
    }
    expect(rows.footerStartRows()).toEqual(own["FOOTER_ROWS_START"])
  })

  it("keeps the text block's bounds and the newsletter's names with theirs", () => {
    const limits = blocks.FOOTER_ROWS_LIMITS
    expect(FOOTER_DOC_LIMITS).toEqual({
      nodes: limits.textNodes,
      textLength: limits.textChars,
      depth: limits.textDepth,
    })
    expect(limits.newsletterText).toBe(NEWSLETTER_LIMITS.description)
    for (const variant of blocks.FOOTER_NEWSLETTER_VARIANTS) {
      expect(SECTION_VARIANTS.newsletter).toContain(variant)
    }
    expect(SECTION_VARIANTS.footer_bar).toEqual(["ledger", "brand_columns", "free_rows"])
    const variants = contract("section-variants")["SECTION_VARIANTS"] as Record<string, unknown>
    expect(SECTION_VARIANTS.footer_bar).toEqual(variants["footer_bar"])
  })
})
