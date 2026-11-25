import { customerTotals } from "../totals"
import type { TotalsOrder } from "../totals"

const order = (more: Partial<TotalsOrder> = {}): TotalsOrder => ({
  customer_id: "cus_1",
  status: "completed",
  currency_code: "try",
  total: "100.00",
  created_at: "2026-11-01T10:00:00Z",
  shipping_address: { province: "İzmir", city: "Bornova" },
  ...more,
})

/** CU1, O4: a customer's numbers, counted as the sales report counts sales. */
describe("customer totals", () => {
  it("adds up orders, spend, average basket, last order and its city", () => {
    const [totals] = customerTotals(
      ["cus_1"],
      [
        order({ total: "100.00", created_at: "2026-11-01T10:00:00Z" }),
        order({
          total: "250.50",
          created_at: "2026-11-20T10:00:00Z",
          shipping_address: { province: "Ankara", city: "Çankaya" },
        }),
        order({ total: "49.99", created_at: "2026-11-10T10:00:00Z", status: "pending" }),
      ]
    )

    expect(totals).toEqual({
      customer_id: "cus_1",
      orders: 3,
      spent: "400.49",
      average: "133.50",
      last_order_at: "2026-11-20T10:00:00.000Z",
      city: "Ankara",
    })
  })

  it("leaves out canceled, draft and archived orders and other currencies", () => {
    const [totals] = customerTotals(
      ["cus_1"],
      [
        order({ status: "canceled" }),
        order({ status: "draft" }),
        order({ status: "archived" }),
        order({ currency_code: "eur" }),
        order({ total: "80.00" }),
      ]
    )

    expect(totals).toMatchObject({ orders: 1, spent: "80.00", average: "80.00" })
  })

  it("answers zeros for a customer without orders, with their own city when given", () => {
    const totals = customerTotals(
      ["cus_1", "cus_2"],
      [order({ customer_id: "cus_9" })],
      new Map([["cus_2", "Bursa"]])
    )

    expect(totals).toEqual([
      {
        customer_id: "cus_1",
        orders: 0,
        spent: "0.00",
        average: "0.00",
        last_order_at: null,
        city: null,
      },
      {
        customer_id: "cus_2",
        orders: 0,
        spent: "0.00",
        average: "0.00",
        last_order_at: null,
        city: "Bursa",
      },
    ])
  })

  it("takes an older order's city when the last one names none", () => {
    const [totals] = customerTotals(
      ["cus_1"],
      [
        order({ created_at: "2026-11-20T10:00:00Z", shipping_address: null }),
        order({ created_at: "2026-11-01T10:00:00Z", shipping_address: { city: "Kadıköy" } }),
      ],
      new Map([["cus_1", "Bursa"]])
    )

    expect(totals?.city).toBe("Kadıköy")
  })
})
