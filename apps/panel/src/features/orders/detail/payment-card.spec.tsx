import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import type { OrderDetail, OrderMoney } from "@/features/orders/api/orders"
import { formatMoney } from "@/lib/format"
import { PaymentCard } from "./payment-card"

const totals = { gross: "390.00", discount: "0.00", net: "390.00" }

function money(credit: string, paid: string): OrderMoney {
  return {
    currency_code: "try",
    lines: [],
    ...totals,
    items: totals,
    shipping: totals,
    credit,
    paid,
    refunded: "0.00",
    refundable: paid,
  }
}

const order = (amount: number, status: string) =>
  ({
    currency_code: "try",
    payment_collections: [{ amount, status, captured_amount: 0, refunded_amount: 0, payments: [] }],
  }) as unknown as OrderDetail

describe("PaymentCard", () => {
  it("reads an order a gift card paid whole as paid, with what the credit took", () => {
    render(<PaymentCard order={order(0, "authorized")} money={money("390.00", "0.00")} />)
    expect(screen.getByText("Kredi ile ödendi")).toBeInTheDocument()
    expect(screen.getByText("Kredi ve hediye kartıyla ödenen")).toBeInTheDocument()
    expect(screen.getByText(formatMoney(390, "try"))).toBeInTheDocument()
  })

  it("leaves an order without credit as the payment says", () => {
    render(<PaymentCard order={order(390, "not_paid")} money={money("0.00", "0.00")} />)
    expect(screen.getByText("Ödenmedi")).toBeInTheDocument()
    expect(screen.queryByText("Kredi ve hediye kartıyla ödenen")).toBeNull()
  })
})
