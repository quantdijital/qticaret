import { stockItemLabel } from "../item-label"

describe("stockItemLabel: what a low-stock alert calls an item (F3.8, adr/0020)", () => {
  it("names the product and its variant", () => {
    expect(stockItemLabel({ product: "Sürmene Şef Bıçağı", variant: "Kahve" })).toBe(
      "Sürmene Şef Bıçağı — Kahve"
    )
  })

  it("leaves out a variant that says nothing more", () => {
    for (const variant of ["", null, undefined, "  ", "Default variant", "Varsayılan"]) {
      expect(stockItemLabel({ product: "Kupa", variant })).toBe("Kupa")
    }
    // A product's only variant is often titled as the product
    expect(stockItemLabel({ product: "Çeri Av Bıçağı", variant: "çeri av bıçağı " })).toBe(
      "Çeri Av Bıçağı"
    )
  })

  it("falls back to the item's own title, then its SKU, for an item with no product", () => {
    expect(stockItemLabel({ item: "Kutu", sku: "KUTU-1" })).toBe("Kutu")
    expect(stockItemLabel({ item: " ", sku: "KUTU-1" })).toBe("KUTU-1")
  })

  it("gives nothing rather than an id when nothing names it", () => {
    expect(stockItemLabel({})).toBe("")
  })
})
