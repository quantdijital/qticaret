import { PaymentActions } from "@medusajs/framework/utils"
import {
  fakeIyzicoAccount,
  fakePaytrAccount,
  startFakeIyzico,
  startFakePaytr,
} from "@qticaret/testing"
import type { FakeIyzico, FakePaytr } from "@qticaret/testing"
import { HOSTED_CHECKOUT } from "../../lib/payments/checkout"
import type { HostedCheckout } from "../../lib/payments/checkout"
import * as iyzicoAccount from "../payment-iyzico/account"
import IyzicoProviderService from "../payment-iyzico/service"
import * as paytrAccount from "../payment-paytr/account"
import PaytrProviderService from "../payment-paytr/service"

jest.mock("../payment-paytr/account", () => ({
  storedPaytrAccount: jest.fn(),
  storedPaymentSettings: jest.fn(),
}))
jest.mock("../payment-iyzico/account", () => ({
  storedIyzicoAccount: jest.fn(),
  storedPaymentSettings: jest.fn(),
  isRecordedForRefund: jest.fn().mockResolvedValue(false),
}))

/**
 * The contract every hosted-form provider keeps (adr/0026; F5 V11, F6.4
 * extends it): it starts only from our route, keeps nothing personal in a
 * session, reads its own provider for the result, takes the money at
 * once, never changes or withdraws a session, and refunds only under our
 * reference. Each provider runs the same cases against its fake server.
 */

const SESSION = "payses_01K8ZB2X9Q6J4V7W3N5R0T1Y2Z"
const SETTINGS = { installments_enabled: true, max_installment: 0, card_provider: null }

const checkout: HostedCheckout = {
  email: "ayse.yilmaz@example.com",
  buyer: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "05320000000",
    address_1: "Atatürk Cad. No: 1",
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34710",
    country_code: "tr",
  },
  ip: "85.105.10.20",
  return_urls: {
    success: "http://localhost:8000/odeme/tamam",
    failure: "http://localhost:8000/odeme/hata",
  },
  basket: [
    { id: "cali_1", kind: "item", name: "Seramik kupa", quantity: 2, amount: 2400 },
    { id: "casm_1", kind: "shipping", name: "Standart Kargo", quantity: 1, amount: 1056 },
  ],
}

interface Harness {
  name: string
  provider: PaytrProviderService | IyzicoProviderService
  start: () => Promise<void>
  stop: () => Promise<void>
  /** Pays the session's form as the shopper would. */
  pay: (data: Record<string, unknown>) => void
}

const paytrKeys = fakePaytrAccount()
const iyzicoKeys = fakeIyzicoAccount()
let paytr: FakePaytr
let iyzico: FakeIyzico

const HARNESSES: Harness[] = [
  {
    name: "PayTR",
    provider: new PaytrProviderService({}),
    start: async () => {
      paytr = await startFakePaytr(paytrKeys)
      process.env["PAYTR_BASE_URL"] = paytr.url
      jest
        .mocked(paytrAccount.storedPaytrAccount)
        .mockResolvedValue({ ...paytrKeys, testMode: true })
      jest.mocked(paytrAccount.storedPaymentSettings).mockResolvedValue(SETTINGS)
    },
    stop: () => paytr.close(),
    pay: (data) => paytr.pay(String(data["merchant_oid"])),
  },
  {
    name: "iyzico",
    provider: new IyzicoProviderService({}),
    start: async () => {
      iyzico = await startFakeIyzico(iyzicoKeys)
      process.env["IYZICO_BASE_URL"] = iyzico.url
      jest
        .mocked(iyzicoAccount.storedIyzicoAccount)
        .mockResolvedValue({ ...iyzicoKeys, testMode: true })
      jest.mocked(iyzicoAccount.storedPaymentSettings).mockResolvedValue(SETTINGS)
    },
    stop: () => iyzico.close(),
    pay: (data) => iyzico.pay(String(data["token"])),
  },
]

const reasonOf = (run: Promise<unknown>) =>
  run.then(
    () => "no error",
    (error: unknown) =>
      (error as { safeMessage?: string }).safeMessage ??
      (error as { providerCode?: string }).providerCode ??
      String(error)
  )

describe.each(HARNESSES)("hosted-form provider contract: $name", (harness) => {
  const { provider } = harness
  const start = (
    data: Record<string, unknown> = { session_id: SESSION, checkout },
    context: Record<string, unknown> = { [HOSTED_CHECKOUT]: true }
  ) => provider.initiatePayment({ amount: 34.56, currency_code: "try", data, context })

  beforeAll(() => harness.start())
  afterAll(() => harness.stop())

  it("starts only from our route, whose checkout it is given", async () => {
    expect(await reasonOf(start(undefined, {}))).toBe("payments.use_checkout_route")
    expect(await reasonOf(start({ session_id: SESSION }))).toBe("payments.checkout_invalid")
  })

  it("refuses a basket that does not add up to the amount: the cart changed", async () => {
    const changed = { ...checkout, basket: checkout.basket.slice(0, 1) }

    expect(await reasonOf(start({ session_id: SESSION, checkout: changed }))).toBe(
      "payments.cart_changed"
    )
  })

  it("keeps the amount in kuruş, test mode and the form, nothing personal", async () => {
    const { data, status } = await start()

    expect(status).toBe("pending")
    expect(data).toMatchObject({
      checkout: null,
      amount: 3456,
      currency_code: "try",
      test_mode: true,
      form_url: expect.stringMatching(/^http/) as unknown,
    })
    expect(JSON.stringify(data)).not.toMatch(/ayse\.yilmaz|Yılmaz|05320000000|Atatürk/)
  })

  it("is pending until the provider shows the payment, then captured", async () => {
    const { data = {} } = await start()

    const before = await provider.authorizePayment({ data })
    harness.pay(data)
    const after = await provider.authorizePayment({ data })
    const status = await provider.getPaymentStatus({ data })

    expect(before.status).toBe("pending")
    expect(after.status).toBe("captured")
    expect(status.status).toBe("captured")
  })

  it("changes and withdraws nothing: the money is taken at once, a form lapses", async () => {
    const data = { reference: "kept" }

    expect(await provider.capturePayment({ data })).toEqual({ data })
    expect(await provider.cancelPayment({ data })).toEqual({ data })
    expect(await provider.deletePayment({ data })).toEqual({ data })
    expect(await provider.retrievePayment({ data })).toEqual({ data })
    expect(await reasonOf(provider.updatePayment())).toBe("payments.restart_checkout")
    expect((await provider.getWebhookActionAndData()).action).toBe(PaymentActions.NOT_SUPPORTED)
  })

  it("refunds nothing without a reference of ours", async () => {
    const { data = {} } = await start()
    harness.pay(data)

    expect(await reasonOf(provider.refundPayment({ amount: 10, data }))).not.toBe("no error")
  })
})
