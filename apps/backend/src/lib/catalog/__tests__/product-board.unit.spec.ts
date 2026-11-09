import {
  categoryAndBelow,
  isColumnOrder,
  isMissing,
  lowestPrice,
  productStock,
  scanProducts,
  stockState,
} from "../product-board"
import type { BoardProduct, BoardVariant } from "../product-board"

const counted = (available: number, item = "iitem_1"): BoardVariant => ({
  manage_inventory: true,
  allow_backorder: false,
  prices: [{ amount: 100, currency_code: "try" }],
  inventory_items: [
    {
      inventory_item_id: item,
      inventory: {
        location_levels: [
          { stocked_quantity: available + 1, reserved_quantity: 1 },
          { stocked_quantity: 0, reserved_quantity: 0 },
        ],
      },
    },
  ],
})

const product = (id: string, fields: Partial<BoardProduct> = {}): BoardProduct => ({
  id,
  title: id,
  updated_at: "2026-11-01T00:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
  thumbnail: "https://cdn.example/1.jpg",
  description: "Paslanmaz çelik.",
  variants: [counted(10)],
  ...fields,
})

const threshold = () => 5

describe("the product list's stock (adr/0022)", () => {
  it("sums what can be sold now over counted variants, none counted reads as null", () => {
    expect(productStock(product("a", { variants: [counted(3), counted(4)] }))).toBe(7)
    expect(
      productStock(
        product("b", {
          variants: [
            { manage_inventory: false },
            { allow_backorder: true, manage_inventory: true },
          ],
        })
      )
    ).toBeNull()
  })

  it("says out only when nothing can be bought, low at the item's threshold", () => {
    expect(stockState(product("a", { variants: [counted(0), counted(-1)] }), threshold)).toBe("out")
    // A variant nobody counts, or sold past its stock, keeps the product buyable
    expect(
      stockState(product("b", { variants: [counted(0), { manage_inventory: false }] }), threshold)
    ).toBe("low")
    expect(stockState(product("c", { variants: [counted(5)] }), threshold)).toBe("low")
    expect(stockState(product("d", { variants: [counted(6)] }), threshold)).toBe("in")
    expect(
      stockState(product("e", { variants: [counted(6, "iitem_x")] }), (id) =>
        id === "iitem_x" ? 10 : 5
      )
    ).toBe("low")
    expect(stockState(product("f", { variants: [{ manage_inventory: false }] }), threshold)).toBe(
      "in"
    )
  })
})

describe("the product list's quick filters", () => {
  it("finds products without a picture, a price on every variant, or a description", () => {
    expect(isMissing(product("a", { thumbnail: null, images: [] }), "image")).toBe(true)
    expect(isMissing(product("b", { thumbnail: null, images: [{ id: "img_1" }] }), "image")).toBe(
      false
    )
    expect(
      isMissing(
        product("c", { variants: [counted(1), { manage_inventory: false, prices: [] }] }),
        "price"
      )
    ).toBe(true)
    expect(isMissing(product("d", { variants: [] }), "price")).toBe(true)
    expect(isMissing(product("e"), "price")).toBe(false)
    expect(isMissing(product("f", { description: "  " }), "description")).toBe(true)
    expect(isMissing(product("g"), "description")).toBe(false)
  })

  it("reads the lowest lira price, other currencies aside", () => {
    expect(
      lowestPrice(
        product("a", {
          variants: [
            {
              prices: [
                { amount: "250", currency_code: "try" },
                { amount: 5, currency_code: "eur" },
              ],
            },
            { prices: [{ amount: 120, currency_code: "try" }] },
          ],
        })
      )
    ).toBe(120)
    expect(lowestPrice(product("b", { variants: [] }))).toBeNull()
  })
})

describe("the product list's scan", () => {
  const rows = [
    product("prod_a", {
      title: "Çakı",
      variants: [counted(0)],
      updated_at: "2026-11-03T00:00:00Z",
    }),
    product("prod_b", {
      title: "bıçak",
      variants: [{ manage_inventory: false, prices: [{ amount: 50, currency_code: "try" }] }],
      product_extension: { kind: "digital" },
    }),
    product("prod_c", {
      title: "Ağaç",
      variants: [counted(3)],
      updated_at: "2026-11-02T00:00:00Z",
    }),
    product("prod_d", { title: "Zımpara", variants: [{ manage_inventory: false, prices: [] }] }),
  ]

  it("filters by stock, kind and what is missing", () => {
    expect(scanProducts(rows, { stock: "out", order: "-updated_at" }, threshold)).toEqual([
      "prod_a",
    ])
    expect(scanProducts(rows, { stock: "low", order: "-updated_at" }, threshold)).toEqual([
      "prod_c",
    ])
    expect(scanProducts(rows, { kind: "digital", order: "-updated_at" }, threshold)).toEqual([
      "prod_b",
    ])
    expect(scanProducts(rows, { kind: "physical", order: "title" }, threshold)).toEqual([
      "prod_c",
      "prod_a",
      "prod_d",
    ])
    expect(scanProducts(rows, { missing: "price", order: "-updated_at" }, threshold)).toEqual([
      "prod_d",
    ])
    // SEO is the advisor's: the scan keeps what Medusa's filter gave
    expect(scanProducts(rows, { missing: "seo", order: "-updated_at" }, threshold)).toHaveLength(4)
  })

  it("orders by price and stock with the products without one last either way", () => {
    expect(scanProducts(rows, { order: "price" }, threshold)).toEqual([
      "prod_b",
      // Equal prices: the latest change first
      "prod_a",
      "prod_c",
      "prod_d",
    ])
    expect(scanProducts(rows, { order: "-price" }, threshold).at(-1)).toBe("prod_d")
    expect(scanProducts(rows, { order: "stock" }, threshold)).toEqual([
      "prod_a",
      "prod_c",
      "prod_b",
      "prod_d",
    ])
    expect(scanProducts(rows, { order: "-stock" }, threshold).slice(0, 2)).toEqual([
      "prod_c",
      "prod_a",
    ])
  })

  it("lets Medusa page the column orders and reads the others itself", () => {
    expect(isColumnOrder("-created_at")).toBe(true)
    expect(isColumnOrder("title")).toBe(true)
    expect(isColumnOrder("price")).toBe(false)
    expect(isColumnOrder("-stock")).toBe(false)
  })
})

describe("a category filter", () => {
  it("takes the category and every one below it", () => {
    const tree = [
      { id: "pcat_root", parent_category_id: null },
      { id: "pcat_knives", parent_category_id: "pcat_root" },
      { id: "pcat_chef", parent_category_id: "pcat_knives" },
      { id: "pcat_other", parent_category_id: null },
    ]
    expect(categoryAndBelow("pcat_root", tree).sort()).toEqual([
      "pcat_chef",
      "pcat_knives",
      "pcat_root",
    ])
    expect(categoryAndBelow("pcat_chef", tree)).toEqual(["pcat_chef"])
  })
})
