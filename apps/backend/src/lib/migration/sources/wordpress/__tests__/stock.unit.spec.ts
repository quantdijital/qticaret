import { sharesParentStock, stockOf } from "../context"
import { simpleVariant, variantsOf } from "../variations"
import type { WordpressContext } from "../context"
import type { WxrItem } from "../reader"

const meta = (entries: Record<string, string>) => new Map(Object.entries(entries))

describe("WooCommerce stock as the migration reads it (adr/0042 Ek 2026-11-20)", () => {
  it.each([
    ["a count it kept", { _manage_stock: "yes", _stock: "7" }, 7],
    ["a negative count as none", { _manage_stock: "yes", _stock: "-3" }, 0],
    ["an empty count as none", { _manage_stock: "yes", _stock: "" }, 0],
    ["uncounted, out of stock", { _manage_stock: "no", _stock_status: "outofstock" }, 0],
    ["uncounted, on sale", { _manage_stock: "no", _stock_status: "instock" }, "untracked"],
    ["uncounted, on backorder", { _stock_status: "onbackorder" }, "untracked"],
    ["nothing said", {}, "untracked"],
  ])("reads %s", (_, own, expected) => {
    expect(stockOf(meta(own))).toBe(expected)
  })

  it("gives a variation under a counting product the product's count", () => {
    const parent = meta({ _manage_stock: "yes", _stock: "12" })
    for (const own of [{ _manage_stock: "parent" }, { _manage_stock: "no" }, {}]) {
      expect(stockOf(meta(own), parent)).toBe(12)
      expect(sharesParentStock(meta(own), parent)).toBe(true)
    }
    // Its own count wins
    const counted = meta({ _manage_stock: "yes", _stock: "2" })
    expect(stockOf(counted, parent)).toBe(2)
    expect(sharesParentStock(counted, parent)).toBe(false)
  })

  it("takes an uncounted product's state for an uncounted variation", () => {
    const parent = meta({ _manage_stock: "no", _stock_status: "outofstock" })
    expect(stockOf(meta({}), parent)).toBe(0)
    expect(stockOf(meta({ _stock_status: "instock" }), meta({}))).toBe("untracked")
  })
})

const item = (id: string, entries: Record<string, string>, extra: Partial<WxrItem> = {}) =>
  ({
    id,
    status: "publish",
    meta: meta(entries),
    terms: [],
    ...extra,
  }) as unknown as WxrItem

function contextWith(product: WxrItem, variations: WxrItem[]): WordpressContext {
  return {
    wxr: {} as WordpressContext["wxr"],
    taxonomies: { term: () => undefined } as unknown as WordpressContext["taxonomies"],
    attachments: new Map(),
    variations: new Map([[product.id, variations]]),
    siteHost: null,
    notes: [],
  }
}

describe("variants' stock", () => {
  it("makes an uncounted simple product untracked", () => {
    const product = item("1", { _regular_price: "10", _stock_status: "instock" })
    expect(simpleVariant(product, "variant:1")?.stock).toBe("untracked")
  })

  it("shares a counting product's pool with each variation, noting it", () => {
    const product = item("2", { _manage_stock: "yes", _stock: "9" })
    const variations = ["S", "M"].map((size, index) =>
      item(String(10 + index), {
        _regular_price: "10",
        _manage_stock: "parent",
        attribute_beden: size,
      })
    )
    const context = contextWith(product, variations)
    const plan = variantsOf(context, product, "product:2", [
      { key: "beden", name: "Beden", global: false, values: ["S", "M"], variation: true },
    ])
    expect(plan.variants.map((variant) => variant.stock)).toEqual([9, 9])
    expect(context.notes.map((note) => [note.source_key, note.key])).toEqual([
      ["variation:10", "migration.wordpress_stock_shared"],
      ["variation:11", "migration.wordpress_stock_shared"],
    ])
  })
})
