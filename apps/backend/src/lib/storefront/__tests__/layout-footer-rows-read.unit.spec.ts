import { layoutDocument, readStoredLayout } from "../layout"
import { FOOTER_ROWS_LIMITS } from "../sections/footer-blocks"
import { footerStartRows } from "../sections/footer-rows"

const L = FOOTER_ROWS_LIMITS
const key = (name: string) => `storefront_layout.${name}`

let serial = 0
/** A fresh id in the sections' form. */
const id = () => `blk${String((serial += 1)).padStart(5, "0")}`

type Fields = Record<string, unknown>
const block = (type: string, more: Fields = {}) => ({ id: id(), type, ...more })
const menu = (slot = 1) => block("menu", { slot })
const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })
const body = (...content: unknown[]) => ({ type: "doc", content })
const words = (more: Fields = {}) => block("text", { body: body(paragraph("Kargo")), ...more })

/** A row whose split takes as many columns as it is given. */
const row = (columns: unknown[][], more: Fields = {}) => ({
  id: id(),
  layout: Array.from({ length: columns.length }, () => "1").join("-"),
  columns: columns.map((blocks) => ({ blocks })),
  ...more,
})
const footer = (more: Fields = {}) => ({
  id: "mainfooter",
  type: "footer_bar",
  variant: "free_rows",
  ...more,
})
const doc = (rows: unknown, more: Fields = {}) => ({ footer: [footer({ rows })], ...more })
const issues = (document: unknown) =>
  layoutDocument.safeParse(document).error?.issues.map((issue) => issue.message) ?? []
const rowsOf = (document: unknown) => {
  const [bar] = readStoredLayout(document).footer
  return bar?.type === "footer_bar" && bar.variant === "free_rows" ? bar.rows : []
}

describe("the free rows footer read back (adr/0070 §2; adr/0049 Ek 2026-11-14 §2.3)", () => {
  it("refuses its fields on the other variants, and theirs on it", () => {
    const rows = [row([[menu(1)]])]
    expect(issues({ footer: [footer({ variant: "ledger", rows })] })).toHaveLength(1)
    expect(issues({ footer: [footer({ variant: "brand_columns", rows })] })).toHaveLength(1)
    expect(issues({ footer: [footer({ top_strip: true })] })).toHaveLength(1)
    expect(issues({ footer: [footer({ ground: "primary" })] })).toEqual([key("section_invalid")])
    expect(issues({ footer: [footer({ badge_style: "mono" })] })).toEqual([key("section_invalid")])
    expect(issues(doc([row([[]], { ground: "dark" })]))).toEqual([key("section_invalid")])
    expect(issues(doc([row([[]], { phone_columns: 3 })]))).toEqual([key("section_invalid")])
  })

  it("forgives on reading: a block it does not read and what stands past a bound are left out", () => {
    const kept = menu(1)
    const stored = doc([
      row([
        [kept, block("carousel", { slides: 3 }), menu(99), { ...menu(2), glow: true }, "x"],
        [block("brand"), block("brand")],
      ]),
      {
        id: "rowwide01",
        layout: "1-1",
        columns: [{ blocks: [words()] }, {}, { blocks: [menu(3)] }],
      },
      { id: "rowodd001", layout: "9-9", columns: [{ blocks: [menu(4)] }] },
      ...Array.from({ length: L.rows }, () => row([[]])),
    ])
    expect(issues(stored).length).toBeGreaterThan(0)
    const rows = rowsOf(stored)
    expect(rows).toHaveLength(L.rows)
    expect(rows[0]?.columns.map((column) => column.blocks.map((each) => each.type))).toEqual([
      ["menu"],
      ["brand"],
    ])
    expect(rows[0]?.columns[0]?.blocks[0]).toMatchObject({ id: kept.id, slot: 1 })
    // Its columns cut to the split; a split off the list reads as a new row's, filled out
    expect(rows[1]?.columns.map((column) => column.blocks.length)).toEqual([1, 0])
    expect(rows[2]).toMatchObject({ layout: "1-1-1" })
    expect(rows[2]?.columns.map((column) => column.blocks.length)).toEqual([1, 0, 0])
  })

  it("forgives a column's seventh block and no row at all on reading", () => {
    const eight = Array.from({ length: L.perColumn + 2 }, (_, at) => menu(at + 1))
    expect(rowsOf(doc([row([eight])]))[0]?.columns[0]?.blocks).toHaveLength(L.perColumn)
    expect(rowsOf(doc([]))).toEqual(footerStartRows())
    expect(rowsOf(doc(["x", 3]))).toEqual(footerStartRows())
  })
})
