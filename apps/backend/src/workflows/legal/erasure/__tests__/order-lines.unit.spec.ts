import { ERASED_TEXT, lineAddons, withoutAddonTexts } from "../../../../lib/catalog/addons"
import type { ChosenAddon } from "../../../../lib/catalog/addons"
import { withoutRecipient } from "../../../../lib/promotions/gift-sale"
import { rewrittenRows } from "../order-lines"

const typed: ChosenAddon = {
  addon_id: "ad_1",
  kind: "text",
  label: "Ürün üzerine yazı",
  value: "Ada Yılmaz",
  amount: 35,
  non_withdrawable: true,
}
const metadataWith = (value: string, extra: Record<string, unknown> = {}) => ({
  ...extra,
  qt_addons: lineAddons([{ ...typed, value }], 1000, null),
})

/** adr/0052 §10 Ek 2026-11-09: each stored copy of a line's metadata rewritten from itself. */
describe("rewrittenRows", () => {
  it("rewrites each copy from its own metadata, keeping what differs between versions", () => {
    const rows = [
      // The line item, then two order versions, one with a key of its own
      { id: "ordli_1", metadata: metadataWith("Ada Yılmaz") },
      { id: "orditem_1", metadata: metadataWith("Ada Yılmaz") },
      { id: "orditem_2", metadata: metadataWith("Ada Yılmaz", { edited: true }) },
    ]

    const rewritten = rewrittenRows(rows, withoutAddonTexts)

    expect(rewritten.map((row) => row.id)).toEqual(["ordli_1", "orditem_1", "orditem_2"])
    expect(JSON.stringify(rewritten)).not.toContain("Ada")
    expect(rewritten[2]?.metadata).toMatchObject({
      edited: true,
      qt_addons: {
        base: 1000,
        non_withdrawable: true,
        items: [{ label: "Ürün üzerine yazı", value: ERASED_TEXT, amount: 35 }],
      },
    })
  })

  it("leaves out copies with nothing to erase: run again, nothing more changes", () => {
    const rows = [
      { id: "orditem_1", metadata: metadataWith(ERASED_TEXT) },
      { id: "orditem_2", metadata: null },
      { id: "orditem_3", metadata: { other: 1 } },
      { id: "orditem_4" },
    ]

    expect(rewrittenRows(rows, withoutAddonTexts)).toEqual([])
    expect(rewrittenRows(rows, withoutRecipient)).toEqual([])
  })
})
