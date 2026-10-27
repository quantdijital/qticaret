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

  it("shows PayTR's record: the transaction, the card and test mode", () => {
    render(
      <PaymentCard
        order={order(330, "completed")}
        money={money("0.00", "330.00")}
        hosted={{
          payment_id: "pay_1",
          provider_id: "pp_paytr_paytr",
          reference: "payses01ABC",
          test_mode: true,
          available: true,
          error_code: null,
          amount: "330.00",
          total: "330.00",
          installments: 1,
          card_brand: "WORLD",
          card_last4: "6747",
          refunds: [],
        }}
      />
    )
    expect(screen.getByText("payses01ABC")).toBeInTheDocument()
    expect(screen.getByText("WORLD •••• 6747")).toBeInTheDocument()
    expect(screen.getByText("Tek çekim")).toBeInTheDocument()
    expect(screen.getByText("Test modu")).toBeInTheDocument()
  })
})
