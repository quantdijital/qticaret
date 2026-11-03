import type { FinanceReport } from "../../../api/admin/reports/finance/read"
import { financeTables } from "../types/report-finance-tables"

const report = (payments: FinanceReport["payments"]): FinanceReport =>
  ({
    period: { key: "month", from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" },
    currency_code: "try",
    capped: false,
    vat: [],
    payments,
    chargebacks: [],
  }) as unknown as FinanceReport

describe("the finance report's file", () => {
  it("names each way to pay as the panel does: a payment marked paid by hand is a manual one", () => {
    const { payments } = financeTables(
      report([
        { method: "paytr", payments: 2, captured: 300, refunded: 0, net: 300 },
        { method: "system", payments: 1, captured: 80, refunded: 0, net: 80 },
      ] as unknown as FinanceReport["payments"])
    )

    expect(payments.slice(1).map((row) => row[0])).toEqual(["PayTR", "Manuel ödeme"])
    expect(JSON.stringify(payments)).not.toMatch(/deneme/i)
  })
})
