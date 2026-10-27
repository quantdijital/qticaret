import { PaymentActions } from "@medusajs/framework/utils"
import { HOSTED_CHECKOUT } from "../../lib/payments/checkout"
import * as settings from "../../lib/payments/settings"
import BankTransferProviderService from "../payment-bank-transfer/service"
import CashOnDeliveryProviderService from "../payment-cod/service"

jest.mock("../../lib/payments/settings", () => ({
  bankTransferSettings: jest.fn(),
}))

/**
 * The contract the offline providers keep (adr/0029; F6.4, beside the
 * hosted forms' in payment-providers.contract): they start only from our
 * route, keep the amount and nothing about the shopper, call no outside
 * service, and refund as a record of the shop's own payment back.
 */

const SESSION = "payses_01K8ZB2X9Q6J4V7W3N5R0T1Y2Z"

interface Harness {
  name: string
  provider: BankTransferProviderService | CashOnDeliveryProviderService
  data: Record<string, unknown>
  /** What authorizing answers when the order is placed. */
  placed: string
}

const HARNESSES: Harness[] = [
  {
    name: "bank transfer",
    provider: new BankTransferProviderService({}),
    data: { session_id: SESSION },
    placed: "pending_authorization",
  },
  {
    name: "cash on delivery",
    provider: new CashOnDeliveryProviderService({}),
    data: { session_id: SESSION, fee: 2_500 },
    placed: "authorized",
  },
]

const reasonOf = (run: Promise<unknown>) =>
  run.then(
    () => "no error",
    (error: unknown) => (error as { safeMessage?: string }).safeMessage ?? String(error)
  )

beforeEach(() => {
  jest.mocked(settings.bankTransferSettings).mockResolvedValue({
    enabled: true,
    account_holder: "Örnek Ticaret A.Ş.",
    bank_name: "Örnek Bankası",
    iban: "TR330006100519786457841326",
    deadline_hours: 48,
  })
})

describe.each(HARNESSES)("offline provider contract: $name", ({ provider, data, placed }) => {
  const start = (context: Record<string, unknown> = { [HOSTED_CHECKOUT]: true }) =>
    provider.initiatePayment({ amount: 235, currency_code: "try", data, context })

  it("starts only from our route", async () => {
    expect(await reasonOf(start({}))).toBe("payments.use_checkout_route")
  })

  it("keeps the amount in kuruş and nothing about the shopper", async () => {
    const { status, data: kept } = await start()

    expect(status).toBe("pending")
    expect(kept).toMatchObject({ amount: 23_500, currency_code: "try" })
    expect(Object.keys(kept ?? {})).not.toEqual(
      expect.arrayContaining(["email", "buyer", "checkout", "phone"])
    )
  })

  it("places the order as Medusa expects of it", async () => {
    const { data: kept = {} } = await start()

    expect((await provider.authorizePayment({ data: kept })).status).toBe(placed)
    expect((await provider.getPaymentStatus({ data: kept })).status).toBe(placed)
  })

  it("captures, cancels, deletes and refunds as a record: nothing is sent anywhere", async () => {
    const kept = { method: "kept" }

    expect(await provider.capturePayment({ data: kept })).toEqual({ data: kept })
    expect(await provider.cancelPayment({ data: kept })).toEqual({ data: kept })
    expect(await provider.deletePayment({ data: kept })).toEqual({ data: kept })
    expect(await provider.retrievePayment({ data: kept })).toEqual({ data: kept })
    expect(await provider.refundPayment({ amount: 10, data: kept })).toEqual({ data: kept })
    expect((await provider.getWebhookActionAndData()).action).toBe(PaymentActions.NOT_SUPPORTED)
  })
})

describe("bank transfer's one update: the shop's confirmation", () => {
  const provider = new BankTransferProviderService({})

  it("takes a confirmation for the same amount, then authorizes; anything else starts again", async () => {
    const data = {
      amount: 23_500,
      confirmed_at: "2026-10-28T09:00:00.000Z",
      confirmed_by: "user_1",
    }

    const confirmed = await provider.updatePayment({ amount: 235, currency_code: "try", data })
    const other = await reasonOf(
      provider.updatePayment({ amount: 300, currency_code: "try", data })
    )

    expect(confirmed.data).toEqual(data)
    expect((await provider.authorizePayment({ data })).status).toBe("authorized")
    expect(other).toBe("payments.restart_checkout")
  })

  it("starts no transfer before the shop turns it on with an account", async () => {
    jest.mocked(settings.bankTransferSettings).mockResolvedValueOnce({
      enabled: false,
      account_holder: "",
      bank_name: "",
      iban: "",
      deadline_hours: 48,
    })

    expect(
      await reasonOf(
        provider.initiatePayment({
          amount: 235,
          currency_code: "try",
          data: { session_id: SESSION },
          // Our route's marker: Medusa's context type does not name it
          context: { [HOSTED_CHECKOUT]: true } as never,
        })
      )
    ).toBe("bank_transfer.not_configured")
  })
})

describe("cash on delivery's updates", () => {
  it("starts again on any change", async () => {
    expect(await reasonOf(new CashOnDeliveryProviderService({}).updatePayment())).toBe(
      "payments.restart_checkout"
    )
  })
})
