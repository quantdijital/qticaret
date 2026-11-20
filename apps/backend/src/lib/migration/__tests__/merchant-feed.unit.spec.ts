import { merchantFeed } from "@qticaret/testing"
import { feedRecords } from "../sources/merchant-feed"

describe("a Google Merchant feed as the common records (F14.3)", () => {
  const records = feedRecords(merchantFeed("https://cdn.example.com"))

  it("groups an item group's items into one product's variants, the sale price the price", () => {
    const [pan, spoon] = records.products
    expect(pan).toMatchObject({
      source_key: "group:TAVA",
      handle: "dokum-tava",
      title: "Döküm Tava",
      description: "Ağır döküm gövde.",
      status: "published",
      categories: [["Mutfak", "Tavalar"]],
      brand: "Demirci & Oğulları",
      // The colour is the same for both: no option of its own
      options: [{ name: "Beden", values: ["24 cm", "28 cm"] }],
      images: [
        "https://cdn.example.com/images/tava.png",
        "https://cdn.example.com/images/tava-yan.png",
      ],
      old_url: "/urun/dokum-tava",
    })
    expect(
      pan?.variants.map((variant) => [
        variant.sku,
        variant.price,
        variant.compare_at_price,
        variant.stock,
        variant.options,
        variant.weight,
        variant.barcode,
      ])
    ).toEqual([
      // In stock with no count: sold uncounted, always sellable (adr/0042 Ek 2026-11-20)
      ["TAVA-24", "899.90", "1099.90", "untracked", { Beden: "24 cm" }, 1500, "8690000000011"],
      ["TAVA-28", "1299.90", null, 0, { Beden: "28 cm" }, 1500, null],
    ])
    // A page's extension is no part of the handle; the old path keeps it for the 301
    expect(spoon).toMatchObject({
      handle: "ahsap-kasik",
      options: [],
      old_url: "/ahsap-kasik.html",
    })
  })

  it("names the categories and brands, and notes what it left out", () => {
    expect(records.categories.map((category) => category.path)).toEqual([
      ["Mutfak", "Tavalar"],
      ["Mutfak", "Gereçler"],
    ])
    expect(records.brands.map((brand) => brand.name)).toEqual(["Demirci & Oğulları"])
    expect(records.notes).toEqual([
      { kind: "product", source_key: "DOLAR", key: "migration.feed_currency" },
      { kind: "product", source_key: "FIYATSIZ", key: "migration.feed_item_invalid" },
    ])
  })

  it("refuses what is no feed", () => {
    expect(() => feedRecords("<html><body/></html>")).toThrow()
    expect(() => feedRecords('<!DOCTYPE x [<!ENTITY a "b">]><rss/>')).toThrow()
  })
})
