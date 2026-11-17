import { layoutDocument } from "../layout"
import { footerRowsOf, plainRowTools } from "../sections/footer-rows-print"

/**
 * The free rows footer's brand block address (adr/0070 §4 Ek): off unless
 * the shop turns it on, so a block saved before it draws as it did.
 */

const brand = (more: Record<string, unknown> = {}) => ({
  id: "footerbrand",
  type: "brand",
  ...more,
})
const doc = (block: Record<string, unknown>) => ({
  footer: [
    {
      id: "mainfooter",
      type: "footer_bar",
      variant: "free_rows",
      rows: [{ id: "footerrow1", layout: "1", columns: [{ blocks: [block] }] }],
    },
  ],
})
const printedBrand = (block: Record<string, unknown>) => {
  const bar = layoutDocument.parse(doc(block)).footer[0]
  const rows = footerRowsOf(
    bar as never,
    plainRowTools(() => null)
  ).rows
  return rows[0]?.columns[0]?.blocks[0]
}

describe("the brand block's address", () => {
  it("reads a block saved before it as off, and prints the switch either way", () => {
    expect(printedBrand(brand())).toMatchObject({ type: "brand", address: false })
    expect(printedBrand(brand({ address: true }))).toMatchObject({ type: "brand", address: true })
  })

  it("takes only a switch", () => {
    expect(layoutDocument.safeParse(doc(brand({ address: "Denizli" }))).success).toBe(false)
  })
})
