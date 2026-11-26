import { COD_PAYMENT_PROVIDER_ID, PAYTR_PAYMENT_PROVIDER_ID } from "../../payments/checkout"
import { saleInvoiceHold, testPaymentProvider } from "../hold"
import type { InvoiceFacts, OrderRow } from "../hold"
import { testPaymentsInvoiced } from "../providers"

const CAPTURED = "2026-11-09T08:00:00Z"

const order = (
  changes: Partial<OrderRow> = {},
  payment: Record<string, unknown> = {}
): OrderRow => ({
  status: "pending",
  canceled_at: null,
  currency_code: "try",
  payment_collections: [
    { payments: [{ provider_id: PAYTR_PAYMENT_PROVIDER_ID, captured_at: CAPTURED, ...payment }] },
  ],
  ...changes,
})

const testPaid = order({}, { data: { test_mode: true } })

const facts = (changes: Partial<InvoiceFacts> = {}): InvoiceFacts => ({
  settings: { provider: "parasut", trigger: "placed" },
  order: order(),
  moments: ["placed", "paid"],
  fakeAllowed: false,
  testPaymentsInvoiced: false,
  ...changes,
})

describe("why an order's sale invoice is held (adr/0034 §8)", () => {
  it("holds nothing for a paid order when the shop invoices once paid", () => {
    expect(saleInvoiceHold(facts())).toBeNull()
  })

  it("says invoicing is off with no program, or the fake one outside tests", () => {
    expect(saleInvoiceHold(facts({ settings: { provider: "none", trigger: "placed" } }))).toBe(
      "off"
    )
    expect(saleInvoiceHold(facts({ settings: { provider: "fake", trigger: "placed" } }))).toBe(
      "off"
    )
    expect(
      saleInvoiceHold(
        facts({ settings: { provider: "fake", trigger: "placed" }, fakeAllowed: true })
      )
    ).toBeNull()
  })

  it("names a canceled order before anything else about it", () => {
    expect(saleInvoiceHold(facts({ order: order({ status: "canceled" }) }))).toBe("canceled")
    expect(saleInvoiceHold(facts({ order: { ...testPaid, canceled_at: CAPTURED } }))).toBe(
      "canceled"
    )
  })

  it("holds an order paid in a provider's test mode, unless test payments are invoiced here", () => {
    expect(saleInvoiceHold(facts({ order: testPaid }))).toBe("test_payment")
    expect(saleInvoiceHold(facts({ order: testPaid, testPaymentsInvoiced: true }))).toBeNull()
    expect(testPaymentProvider(testPaid)).toBe(PAYTR_PAYMENT_PROVIDER_ID)
    expect(testPaymentProvider(order())).toBeNull()
  })

  it("holds a sale in another currency", () => {
    expect(saleInvoiceHold(facts({ order: order({ currency_code: "eur" }) }))).toBe("currency")
    expect(saleInvoiceHold(facts({ order: order({ currency_code: "TRY" }) }))).toBeNull()
  })

  it("says what it waits for: the payment, the parcel leaving, or cash on delivery's delivery", () => {
    const unpaid = order({}, { provider_id: "pp_bank-transfer_bank-transfer", captured_at: null })
    expect(saleInvoiceHold(facts({ order: unpaid }))).toBe("awaiting_payment")

    const onShipping = { provider: "parasut" as const, trigger: "shipped" as const }
    expect(saleInvoiceHold(facts({ settings: onShipping }))).toBe("awaiting_shipment")
    expect(
      saleInvoiceHold(facts({ settings: onShipping, moments: ["placed", "paid", "shipped"] }))
    ).toBeNull()

    const cash = order({}, { provider_id: COD_PAYMENT_PROVIDER_ID, captured_at: null })
    expect(saleInvoiceHold(facts({ order: cash }))).toBe("awaiting_delivery")
    expect(
      saleInvoiceHold(facts({ order: cash, moments: ["placed", "paid", "shipped", "delivered"] }))
    ).toBeNull()
  })

  it("lets a paid order of gift cards alone through, whatever the setting", () => {
    const onShipping = { provider: "parasut" as const, trigger: "shipped" as const }
    expect(saleInvoiceHold(facts({ settings: onShipping, advanceOnly: true }))).toBeNull()
  })
})

describe("test payments invoiced on a developer's machine only", () => {
  const FAKE = "http://127.0.0.1:9108"

  it("invoices them in development and tests with the fake Paraşüt on this machine", () => {
    expect(
      testPaymentsInvoiced("parasut", { NODE_ENV: "development", PARASUT_BASE_URL: FAKE })
    ).toBe(true)
    expect(
      testPaymentsInvoiced("parasut", {
        NODE_ENV: "test",
        PARASUT_BASE_URL: "http://localhost:4321",
      })
    ).toBe(true)
  })

  it("never deployed, whatever is set", () => {
    for (const NODE_ENV of ["production", "staging", undefined] as const) {
      expect(testPaymentsInvoiced("parasut", { NODE_ENV, PARASUT_BASE_URL: FAKE })).toBe(false)
    }
  })

  it("not with the real Paraşüt, an address off this machine, or another program", () => {
    expect(testPaymentsInvoiced("parasut", { NODE_ENV: "development" })).toBe(false)
    expect(
      testPaymentsInvoiced("parasut", {
        NODE_ENV: "development",
        PARASUT_BASE_URL: "https://api.parasut.com",
      })
    ).toBe(false)
    for (const provider of ["external", "fake", "none"] as const) {
      expect(testPaymentsInvoiced(provider, { NODE_ENV: "test", PARASUT_BASE_URL: FAKE })).toBe(
        false
      )
    }
  })

  it("never waits for the parcel while BirFatura ships it (adr/0072 Ek 2026-11-26)", () => {
    const birfatura = { provider: "birfatura" as const, trigger: "shipped" as const }
    const cod = order({
      payment_collections: [
        { payments: [{ provider_id: COD_PAYMENT_PROVIDER_ID, captured_at: null }] },
      ],
    })
    const waiting = order({}, { captured_at: null })
    expect(saleInvoiceHold(facts({ settings: birfatura }))).toBe("awaiting_shipment")
    expect(saleInvoiceHold(facts({ settings: birfatura, birfaturaShips: true }))).toBeNull()
    expect(
      saleInvoiceHold(facts({ settings: birfatura, order: cod, birfaturaShips: true }))
    ).toBeNull()
    expect(
      saleInvoiceHold(facts({ settings: birfatura, order: waiting, birfaturaShips: true }))
    ).toBe("awaiting_payment")
    // The other holds stay: such an order never reaches BirFatura, staff ship it by hand
    expect(
      saleInvoiceHold(facts({ settings: birfatura, order: testPaid, birfaturaShips: true }))
    ).toBe("test_payment")
  })
})
