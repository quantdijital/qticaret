import { documentOf, pricedVariantIds } from "../source"
import type { ProductSource } from "../source"

const product = (over: Partial<ProductSource> = {}): ProductSource => ({
  id: "prod_1",
  title: "Şef Bıçağı",
  status: "published",
  created_at: "2026-11-01T10:00:00.000Z",
  ...over,
})

describe("a product's search row (adr/0056)", () => {
  it("reads what listings filter by: channels, categories, brand, choice options", () => {
    const row = documentOf(
      product({
        collection_id: "pcol_1",
        sales_channels: [{ id: "sc_1" }, null],
        categories: [
          { id: "pcat_shown", name: "Mutfak", is_active: true, is_internal: false },
          { id: "pcat_hidden", name: "Gizli Raf", is_active: false },
        ],
        brand: { id: "brand_1", name: "Atölye", handle: "atolye" },
        attribute_values: [
          {
            value_text: "seramik",
            definition: { key: "malzeme", type: "select", is_public: true },
          },
          {
            value_options: ["kirmizi", "mavi"],
            definition: { key: "renk", type: "multi_select", is_public: true },
          },
          { value_text: "x", definition: { key: "not", type: "text", is_public: true } },
        ],
      }),
      { "reg_1:try": 450 }
    )
    expect(row).toMatchObject({
      product_id: "prod_1",
      published: true,
      title: "sef bicagi",
      sales_channel_ids: ["sc_1"],
      // Every category for listings; the shown ones alone named for chips and words
      category_ids: ["pcat_shown", "pcat_hidden"],
      categories: [{ id: "pcat_shown", name: "Mutfak" }],
      collection_id: "pcol_1",
      brand: { id: "brand_1", handle: "atolye", name: "Atölye" },
      options: ["malzeme=seramik", "renk=kirmizi", "renk=mavi"],
      prices: { "reg_1:try": 450 },
      product_created_at: "2026-11-01T10:00:00.000Z",
    })
    expect(row.fields.b.m).toBe("atölye mutfak")
  })

  it("leaves a hidden attribute out of its words (T5)", () => {
    const row = documentOf(
      product({
        attribute_values: [
          { value_text: "gizli", definition: { type: "text", is_public: false } },
          { value_text: "Açık", definition: { type: "text", is_public: true } },
        ],
      }),
      {}
    )
    expect(row.fields.c.m).toBe("açık")
  })

  it("is in stock with stock on a shelf, sold past stock, or keeping no count", () => {
    const level = (available: number) => ({
      inventory_items: [{ inventory: { location_levels: [{ available_quantity: available }] } }],
    })
    const stock = (variants: ProductSource["variants"]) =>
      documentOf(product({ variants }), {}).in_stock
    expect(stock([level(0), level(2)])).toBe(true)
    expect(stock([level(0)])).toBe(false)
    expect(stock([{ ...level(0), allow_backorder: true }])).toBe(true)
    expect(stock([{ manage_inventory: false }])).toBe(true)
    expect(stock([])).toBe(false)
  })

  it("reads its codes and option values as words", () => {
    const row = documentOf(
      product({
        variants: [
          {
            sku: "KUPA-01",
            barcode: "8690000000001",
            variant_extension: { mpn: "MX 5" },
            options: [{ value: "Kırmızı" }],
            title: "Kırmızı",
          },
        ],
        status: "draft",
      }),
      {}
    )
    expect(row.published).toBe(false)
    expect(row.fields.a.f).toBe("sef bicagi kupa 01 kupa01 8690000000001 mx 5 mx5")
    expect(row.fields.c.m).toBe("kırmızı")
  })

  it("keeps whether it is on sale now; a draft is listed nowhere (adr/0023 Ek 2026-11-05)", () => {
    expect(documentOf(product(), {}).on_sale).toBe(false)
    expect(documentOf(product(), {}, true).on_sale).toBe(true)
    expect(documentOf(product({ status: "draft" }), {}, true).on_sale).toBe(false)
  })

  it("prices a dated product by its paying categories only (adr/0077 §5)", () => {
    const variants = [{ id: "adult" }, { id: "child" }, { id: "infant" }]
    const pax_by_variant = { infant: { pax: 0 } }
    expect(
      pricedVariantIds(
        product({
          variants,
          product_extension: { booking_mode: "departure" },
          bookable: { pax_by_variant },
        })
      )
    ).toEqual(["adult", "child"])
    // Not dated: every variant, whatever settings it kept
    expect(
      pricedVariantIds(
        product({
          variants,
          product_extension: { booking_mode: "none" },
          bookable: { pax_by_variant },
        })
      )
    ).toEqual(["adult", "child", "infant"])
    // No category takes a place: still a price to show
    expect(
      pricedVariantIds(
        product({
          variants: [{ id: "infant" }],
          product_extension: { booking_mode: "departure" },
          bookable: { pax_by_variant },
        })
      )
    ).toEqual(["infant"])
  })
})
