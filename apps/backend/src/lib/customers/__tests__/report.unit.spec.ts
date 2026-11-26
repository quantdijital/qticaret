import { customerExportRow } from "../export-rows"
import { customersReport } from "../report"

const DAY = 24 * 60 * 60 * 1000
const from = new Date("2026-11-01T00:00:00.000+03:00")
const window = {
  from,
  to: new Date(from.getTime() + 3 * DAY),
  previousFrom: new Date(from.getTime() - 3 * DAY),
  previousTo: from,
  buckets: [0, 1, 2].map((day) => new Date(from.getTime() + day * DAY)),
  bucketMs: DAY,
}
const at = (days: number) => new Date(from.getTime() + days * DAY + 60_000)

describe("customers report (R1)", () => {
  it("counts new customers by day against the period before", () => {
    const report = customersReport(
      window,
      [
        { created_at: at(0), has_account: true },
        { created_at: at(2), has_account: false },
        { created_at: at(-3), has_account: true },
        { created_at: at(5), has_account: true },
      ],
      [],
      new Set()
    )
    expect(report.new_customers).toEqual({ current: 2, previous: 1, registered: 1, guest: 1 })
    expect(report.series.map((row) => [row.current, row.previous])).toEqual([
      [1, 1],
      [0, 0],
      [1, 0],
    ])
    expect(report.returning_rate).toBe(0)
    expect(report.spent_per_buyer).toBe("0.00")
  })

  it("tells returning buyers and the top spenders from sales only", () => {
    const report = customersReport(
      window,
      [],
      [
        { customer_id: "cus_a", total: "100.00", created_at: at(0) },
        { customer_id: "cus_a", total: "50.50", created_at: at(1) },
        { customer_id: "cus_b", total: "300.00", created_at: at(1) },
        { customer_id: "cus_c", total: "999.00", created_at: at(1), status: "canceled" },
        { customer_id: "cus_d", total: "999.00", created_at: at(1), currency_code: "eur" },
        { customer_id: null, total: "40.00", created_at: at(1) },
        { customer_id: "cus_e", total: "10.00", created_at: at(-1) },
      ],
      new Set(["cus_b"])
    )
    expect(report.buyers).toBe(2)
    expect(report.returning).toBe(1)
    expect(report.returning_rate).toBe(0.5)
    expect(report.spent_per_buyer).toBe("225.25")
    expect(report.top).toEqual([
      { customer_id: "cus_b", orders: 1, spent: "300.00" },
      { customer_id: "cus_a", orders: 2, spent: "150.50" },
    ])
  })
})

describe("customer export rows (CU2)", () => {
  it("writes what the list shows and nothing more", () => {
    const row = customerExportRow(
      {
        id: "cus_a",
        first_name: " Ayşe ",
        last_name: "Yılmaz",
        company_name: "",
        email: "ayse@example.com",
        has_account: true,
        created_at: "2026-11-01T09:30:00.000Z",
      },
      {
        customer_id: "cus_a",
        orders: 2,
        spent: "150.50",
        average: "75.25",
        last_order_at: "2026-11-02T10:00:00.000Z",
        city: "İstanbul",
      }
    )
    expect(row).toEqual([
      "Ayşe Yılmaz",
      null,
      "ayse@example.com",
      "Üye",
      "2026-11-01 12:30",
      2,
      150.5,
      75.25,
      "2026-11-02 13:00",
      "İstanbul",
    ])
    expect(
      customerExportRow(
        { id: "cus_b", has_account: false, created_at: "2026-11-01T00:00:00Z" },
        undefined
      )
    ).toEqual([null, null, null, "Misafir", "2026-11-01 03:00", 0, 0, 0, null, null])
  })
})
