import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { HOSTED_CHECKOUT } from "../../../lib/payments/checkout"
import type { HostedCheckout } from "../../../lib/payments/checkout"
import {
  isRecordedForRefund,
  recoveryRefundReference,
  storedPaymentSettings,
  storedPaytrAccount,
} from "../account"
import PaytrProviderService from "../service"

jest.mock("../account", () => ({
  storedPaytrAccount: jest.fn(),
  storedPaymentSettings: jest.fn(),
  isRecordedForRefund: jest.fn(),
  recoveryRefundReference: jest.fn(),
}))

// A made-up account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()
const stored = jest.mocked(storedPaytrAccount)
const settings = jest.mocked(storedPaymentSettings)
const recorded = jest.mocked(isRecordedForRefund)

const checkout: HostedCheckout = {
  email: "ayse.yilmaz@example.com",
  buyer: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "05320000000",
    address_1: "Atatürk Cad. No: 1",
    address_2: null,
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34710",
    country_code: "tr",
  },
  ip: "85.105.10.20",
  return_urls: {
    success: "https://magaza.example.com/odeme/tamam",
    failure: "https://magaza.example.com/odeme/hata",
  },
  basket: [
    { id: "item_1", kind: "item", name: "Seramik kupa", quantity: 2, amount: 2400 },
    { id: "sm_1", kind: "shipping", name: "Standart Kargo", quantity: 1, amount: 1056 },
  ],
}

const reasonOf = async (run: Promise<unknown>) =>
  run.then(
    () => "no error",
    (error: unknown) =>
      (error as { safeMessage?: string; providerCode?: string }).safeMessage ??
      (error as { providerCode?: string }).providerCode
  )

describe("PayTR payment provider (adr/0026)", () => {
  let fake: FakePaytr
  const provider = new PaytrProviderService({})
  const start = (
    data: Record<string, unknown>,
    amount = 34.56,
    context: Record<string, unknown> = { [HOSTED_CHECKOUT]: true }
  ) =>
    provider.initiatePayment({
      amount,
      currency_code: "try",
      data,
      context,
    })

  beforeAll(async () => {
    fake = await startFakePaytr(account)
    // Read on the first PayTR call (lib/payments/paytr/client.ts)
    process.env["PAYTR_BASE_URL"] = fake.url
  })

  afterAll(async () => {
    delete process.env["PAYTR_BASE_URL"]
    await fake.close()
  })

  beforeEach(() => {
    stored.mockResolvedValue({ ...account, testMode: true })
    recorded.mockResolvedValue(false)
    jest.mocked(recoveryRefundReference).mockResolvedValue(null)
    settings.mockResolvedValue({
      installments_enabled: true,
      max_installment: 0,
      card_provider: null,
    })
    fake.requests.length = 0
  })

  it("gets a token for the cart's basket and keeps nothing personal in the session", async () => {
    const session = await start({ session_id: "payses_01ABC", checkout })

    expect(session).toMatchObject({
      id: "payses01ABC",
      status: "pending",
      data: {
        checkout: null,
        merchant_oid: "payses01ABC",
        amount: 3456,
        currency_code: "try",
        test_mode: true,
      },
    })
    expect(session.data?.["form_url"]).toBe(
      `${fake.url}/odeme/guvenli/${String(session.data?.["token"])}`
    )
    expect(JSON.stringify(session)).not.toMatch(
      /ayse\.yilmaz|Yılmaz|05320000000|85\.105\.10\.20|Atatürk/
    )
    const sent = fake.requests.find((request) => request.path === "/odeme/api/get-token")?.fields
    expect(sent).toMatchObject({
      merchant_oid: "payses01ABC",
      payment_amount: "3456",
      user_ip: "85.105.10.20",
      email: "ayse.yilmaz@example.com",
      user_name: "Ayşe Yılmaz",
      user_phone: "05320000000",
      merchant_ok_url: "https://magaza.example.com/odeme/tamam",
      test_mode: "1",
    })
    expect(JSON.parse(Buffer.from(sent?.["user_basket"] ?? "", "base64").toString("utf8"))).toEqual(
      [
        ["Seramik kupa", "12.00", 2],
        ["Standart Kargo", "10.56", 1],
      ]
    )
  })

  it("passes the shop's installment choice to PayTR", async () => {
    settings.mockResolvedValue({
      installments_enabled: true,
      max_installment: 6,
      card_provider: null,
    })
    await start({ session_id: "payses_01INS", checkout })
    settings.mockResolvedValue({
      installments_enabled: false,
      max_installment: 6,
      card_provider: null,
    })
    await start({ session_id: "payses_01ONE", checkout })

    const sent = fake.requests.filter((request) => request.path === "/odeme/api/get-token")
    expect(sent.map(({ fields }) => [fields["max_installment"], fields["no_installment"]])).toEqual(
      [
        ["6", "0"],
        ["0", "1"],
      ]
    )
  })

  it("starts no session Medusa's own route asks for", async () => {
    expect(await reasonOf(start({ session_id: "payses_01ABC", checkout }, 34.56, {}))).toBe(
      "payments.use_checkout_route"
    )
    expect(fake.requests).toHaveLength(0)
  })

  it("refuses a basket that does not add up to the payment, and a missing account", async () => {
    expect(await reasonOf(start({ session_id: "payses_01ABC", checkout }, 40))).toBe(
      "payments.cart_changed"
    )
    expect(await reasonOf(start({ session_id: "payses_01ABC" }))).toBe("payments.checkout_invalid")
    stored.mockResolvedValue(null)
    expect(await reasonOf(start({ session_id: "payses_01ABC", checkout }))).toBe(
      "paytr.not_configured"
    )
    expect(fake.requests).toHaveLength(0)
  })

  it("authorizes only what PayTR took for the session, as captured", async () => {
    const data = (await start({ session_id: "payses_01PAY", checkout })).data ?? {}

    expect(await provider.authorizePayment({ data })).toMatchObject({ status: "pending" })
    fake.pay("payses01PAY")
    expect(await provider.authorizePayment({ data })).toMatchObject({ status: "captured" })
    expect(await provider.getPaymentStatus({ data: { ...data, amount: 9999 } })).toMatchObject({
      status: "error",
    })
    expect(await provider.getPaymentStatus({ data: { ...data, test_mode: false } })).toMatchObject({
      status: "error",
    })
  })

  it("never authorizes a payment recorded to be given back, or given back already", async () => {
    const data = (await start({ session_id: "payses_01REC", checkout })).data ?? {}
    fake.pay("payses01REC")

    recorded.mockResolvedValue(true)
    const whileRecorded = await provider.authorizePayment({ data })
    recorded.mockResolvedValue(false)
    fake.payments.get("payses01REC")?.refunds.push({ amount: 100, referenceNo: null })
    const refunded = await provider.authorizePayment({ data })

    expect(whileRecorded).toMatchObject({ status: "error" })
    expect(recorded).toHaveBeenCalledWith("payses01REC")
    expect(refunded).toMatchObject({ status: "error" })
  })

  it("lets a session go without asking PayTR, and wants a new start for a new amount", async () => {
    expect(await provider.deletePayment({ data: { merchant_oid: "x" } })).toEqual({
      data: { merchant_oid: "x" },
    })
    expect(await reasonOf(provider.updatePayment())).toBe("payments.restart_checkout")
    expect(fake.requests).toHaveLength(0)
  })

  /** A paid session whose notification the shop acknowledged, as PayTR requires for refunds. */
  const paidSession = async (sessionId: string) => {
    const data = (await start({ session_id: sessionId, checkout })).data ?? {}
    const oid = String(data["merchant_oid"])
    fake.pay(oid)
    const payment = fake.payments.get(oid)
    if (payment) {
      payment.notified = true
    }
    return { data, oid }
  }

  const sentRefunds = () => fake.requests.filter((request) => request.path === "/odeme/iade")
  // Medusa's own refund (no order refund named one), and one our refund workflow named;
  // Medusa brings a new key to every try
  let tries = 0
  const own = (lira: number, data: Record<string, unknown>, key = `ref_01TRY${String(++tries)}`) =>
    provider.refundPayment({ amount: lira, data, context: { idempotency_key: key } })
  const named = (amount: number, data: Record<string, unknown>, reference: string) =>
    own(amount / 100, { ...data, pending_refund: { reference_no: reference, amount } })

  // Medusa's own refunds, try by try and amount by amount: refund.unit.spec.ts
  it("sends parts of different amounts, and never one past what was paid", async () => {
    const { data, oid } = await paidSession("payses_01PRT")

    await named(1000, data, "qtref01A")
    await named(2000, data, "qtref01B")
    fake.requests.length = 0
    // 30,00 of 34,56 given back: 5,00 more, or the whole payment, would pass it
    expect(await reasonOf(named(500, data, "qtref01C"))).toBe("paytr.refund_exceeds_payment")
    expect(await reasonOf(own(34.56, data))).toBe("paytr.refund_exceeds_payment")

    expect(sentRefunds()).toHaveLength(0)
    expect(fake.payments.get(oid)?.refunds).toEqual([
      { amount: 1000, referenceNo: "qtref01A" },
      { amount: 2000, referenceNo: "qtref01B" },
    ])
  })

  it("says why PayTR refused a refund, and never refunds across test and live", async () => {
    const { data } = await paidSession("payses_01RFX")

    expect(await reasonOf(own(99, data))).toBe("paytr.refund_exceeds_payment")
    expect(await reasonOf(own(10, { ...data, test_mode: false }))).toBe("paytr.test_mode_mismatch")
    expect(await reasonOf(provider.refundPayment({ amount: 10, data }))).toBe(
      "payments.refund_reference_missing"
    )
  })

  it("keeps one reference across tries when the refund workflow named it", async () => {
    const { data, oid } = await paidSession("payses_01PND")

    await named(1000, data, "qtref01KEY")
    await named(1000, data, "qtref01KEY")

    expect(fake.payments.get(oid)?.refunds).toEqual([{ amount: 1000, referenceNo: "qtref01KEY" }])
  })

  it("does nothing on a cancel: a captured payment goes back through a refund", async () => {
    const { data, oid } = await paidSession("payses_01CNL")

    expect(await provider.cancelPayment({ data })).toEqual({ data })
    expect(fake.payments.get(oid)?.refunds).toEqual([])
  })
})
