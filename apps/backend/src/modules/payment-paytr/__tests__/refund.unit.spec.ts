import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { kurus } from "../../../lib/money"
import { HOSTED_CHECKOUT } from "../../../lib/payments/checkout"
import type { HostedCheckout } from "../../../lib/payments/checkout"
import {
  isRecordedForRefund,
  recoveryRefundReference,
  storedPaymentSettings,
  storedPaytrAccount,
} from "../account"
import { ownRefundReferenceOf } from "../refund"
import PaytrProviderService from "../service"

jest.mock("../account", () => ({
  storedPaytrAccount: jest.fn(),
  storedPaymentSettings: jest.fn(),
  isRecordedForRefund: jest.fn(),
  recoveryRefundReference: jest.fn(),
}))

// A made-up account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()
const OID = "payses01JABCDEFGHJKMNPQRSTVWXYZ0"

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
  basket: [{ id: "item_1", kind: "item", name: "Seramik kupa", quantity: 1, amount: 3456 }],
}

const reasonOf = (run: Promise<unknown>) =>
  run.then(
    () => "no error",
    (error: unknown) => (error as { safeMessage?: string }).safeMessage
  )

describe("Medusa's own PayTR refund reference: the payment's, the amount's, its count's", () => {
  it("counts the refunds of this amount the payment's data records", () => {
    const records = (references: string[]) => ({
      refunds: references.map((reference_no) => ({ reference_no, amount: 1000 })),
    })

    expect(ownRefundReferenceOf(OID, kurus(1000), {})).toBe(`M${OID}A1000N1`)
    expect(ownRefundReferenceOf(OID, kurus(1000), records([`M${OID}A1000N1`]))).toBe(
      `M${OID}A1000N2`
    )
    // Another amount, an order refund's or the job's reference: not this amount's count
    expect(
      ownRefundReferenceOf(OID, kurus(500), records([`M${OID}A1000N1`, "qtref01A", `R${OID}`]))
    ).toBe(`M${OID}A500N1`)
  })

  it("stays letters and digits within 64, its amount and count whole", () => {
    const long = "p".repeat(64)
    const reference = ownRefundReferenceOf(long, kurus(123456789), {
      refunds: [{ reference_no: ownRefundReferenceOf(long, kurus(123456789), {}), amount: 1 }],
    })

    expect(reference).toHaveLength(64)
    expect(reference).toMatch(/^Mp+A123456789N2$/)
  })
})

describe("Medusa's own PayTR refunds: a retried try sent once, a second refund sent", () => {
  let fake: FakePaytr
  const provider = new PaytrProviderService({})
  let tries = 0
  // Medusa brings a new key to every try
  const own = (lira: number, data: Record<string, unknown>) =>
    provider.refundPayment({
      amount: lira,
      data,
      context: { idempotency_key: `ref_01TRY${String(++tries)}` },
    })
  const sent = () => fake.requests.filter((request) => request.path === "/odeme/iade")

  /** A paid session whose notification the shop acknowledged, as PayTR requires for refunds. */
  const paidSession = async (sessionId: string) => {
    const context: Record<string, unknown> = { [HOSTED_CHECKOUT]: true }
    const started = await provider.initiatePayment({
      amount: 34.56,
      currency_code: "try",
      data: { session_id: sessionId, checkout },
      context,
    })
    const data = started.data ?? {}
    const oid = String(data["merchant_oid"])
    fake.pay(oid)
    const payment = fake.payments.get(oid)
    if (payment) {
      payment.notified = true
    }
    fake.requests.length = 0
    return { data, oid }
  }

  beforeAll(async () => {
    fake = await startFakePaytr(account)
    process.env["PAYTR_BASE_URL"] = fake.url
  })

  afterAll(async () => {
    delete process.env["PAYTR_BASE_URL"]
    await fake.close()
  })

  beforeEach(() => {
    jest.mocked(storedPaytrAccount).mockResolvedValue({ ...account, testMode: true })
    jest.mocked(isRecordedForRefund).mockResolvedValue(false)
    jest.mocked(recoveryRefundReference).mockResolvedValue(null)
    jest.mocked(storedPaymentSettings).mockResolvedValue({
      installments_enabled: true,
      max_installment: 0,
      card_provider: null,
    })
  })

  it("sends a try once when it comes again before its data was kept", async () => {
    const { data, oid } = await paidSession("payses_01REF")

    const first = await own(10, data)
    // A retried step, or a second run: the payment's data as it was, a key of its own
    const again = await own(10, data)

    const made = [{ reference_no: `M${oid}A1000N1`, amount: 1000 }]
    expect([first, again].map((each) => each.data?.["refunds"])).toEqual([made, made])
    expect(sent()).toHaveLength(1)
  })

  it("sends a second refund of the same amount once the first is kept", async () => {
    const { data, oid } = await paidSession("payses_01TWO")

    const first = await own(10, data)
    const second = await own(10, first.data ?? {})

    expect(sent()).toHaveLength(2)
    expect(second.data?.["refunds"]).toEqual([
      { reference_no: `M${oid}A1000N1`, amount: 1000 },
      { reference_no: `M${oid}A1000N2`, amount: 1000 },
    ])
  })

  it("records a second refund whose answer was lost, and never sends it again", async () => {
    const { data, oid } = await paidSession("payses_01LST")
    const kept = { ...data, refunds: [{ reference_no: `M${oid}A1000N1`, amount: 1000 }] }
    fake.payments
      .get(oid)
      ?.refunds.push(
        { amount: 1000, referenceNo: `M${oid}A1000N1` },
        { amount: 1000, referenceNo: `M${oid}A1000N2` }
      )

    const refund = await own(10, kept)

    expect(refund.data?.["refunds"]).toEqual([
      { reference_no: `M${oid}A1000N1`, amount: 1000 },
      { reference_no: `M${oid}A1000N2`, amount: 1000 },
    ])
    expect(sent()).toHaveLength(0)
  })

  it("takes the recovery job's refund of the same amount as made once, never for a second", async () => {
    const { data, oid } = await paidSession("payses_01JOB")
    fake.payments.get(oid)?.refunds.push({ amount: 3456, referenceNo: `R${oid}` })
    jest.mocked(recoveryRefundReference).mockResolvedValue(`R${oid}`)

    const refund = await own(34.56, data)
    // The job's refund answers the first; a second of the amount would pass the payment
    const second = own(34.56, refund.data ?? {})

    expect(refund.data?.["refunds"]).toEqual([{ reference_no: `R${oid}`, amount: 3456 }])
    expect(await reasonOf(second)).toBe("paytr.refund_exceeds_payment")
    expect(recoveryRefundReference).toHaveBeenCalledWith(oid)
    expect(sent()).toHaveLength(0)
  })
})
