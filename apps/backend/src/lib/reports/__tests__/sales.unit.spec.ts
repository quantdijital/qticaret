import { brandSales, promotionEffect, returnRates, sourceSales } from "../sales"
import type { SalesOrder } from "../sales"

const order = (id: string, total: number, more: Partial<SalesOrder> = {}): SalesOrder => ({
  id,
  total,
  cart: { id: `cart_${id}` },
  ...more,
})

const ORDERS: SalesOrder[] = [
  order("o1", 250, {
    items: [
      {
        total: 200,
        product: { brand: { id: "b1", name: "Örnek" } },
        adjustments: [{ code: "YAZ10", amount: 20 }],
      },
      { total: 50, product: { brand: null } },
    ],
    shipping_methods: [{ adjustments: [{ code: "YAZ10", amount: 9.9 }] }],
    payment_collections: [{ refunded_amount: 50 }],
  }),
  order("o2", 100.1, {
    items: [
      {
        total: 100.1,
        product: { brand: { id: "b1", name: "Örnek" } },
        adjustments: [{ code: null, amount: 5 }],
      },
    ],
  }),
  order("o3", 80, { items: [{ total: 80, product: { brand: { id: "b2", name: "Diğer" } } }] }),
]

describe("sales report cuts (F11.2)", () => {
  it("sums sales by brand to the kuruş, a product without one apart", () => {
    expect(brandSales(ORDERS, 10)).toEqual([
      { key: "b1", name: "Örnek", sales: "300.10" },
      { key: "b2", name: "Diğer", sales: "80.00" },
      { key: "none", name: null, sales: "50.00" },
    ])
  })

  it("tells each code's orders, discount and sales, an automatic promotion apart", () => {
    expect(promotionEffect(ORDERS)).toEqual([
      { code: "YAZ10", orders: 1, discount: "29.90", sales: "250.00" },
      { code: null, orders: 1, discount: "5.00", sales: "100.10" },
    ])
  })

  it("counts the orders that asked for a return or an exchange, and what was refunded", () => {
    const rates = returnRates(ORDERS, [
      { order_id: "o1", kind: "return" },
      { order_id: "o1", kind: "return" },
      { order_id: "o2", kind: "exchange" },
      { order_id: "elsewhere", kind: "return" },
    ])

    expect(rates).toEqual({
      orders: 3,
      returned: 1,
      exchanged: 1,
      return_rate: 1 / 3,
      exchange_rate: 1 / 3,
      refunded: "50.00",
    })
  })

  it("puts each order under its cart's first landing, the untold under unknown", () => {
    const sources = sourceSales(
      ORDERS,
      new Map([
        ["cart_o1", "organic_search"],
        ["cart_o2", "paid_search"],
      ])
    )

    expect(sources.find((row) => row.source === "organic_search")).toEqual({
      source: "organic_search",
      orders: 1,
      sales: "250.00",
    })
    expect(sources.find((row) => row.source === "unknown")).toMatchObject({
      orders: 1,
      sales: "80.00",
    })
    expect(sources.reduce((sum, row) => sum + row.orders, 0)).toBe(3)
  })
})
