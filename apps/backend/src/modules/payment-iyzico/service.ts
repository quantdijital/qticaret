import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentSessionStatus,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { AbstractPaymentProvider, PaymentActions } from "@medusajs/framework/utils"
import { backendUrl } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount, kurus, sumKurus } from "../../lib/money"
import { hostedCheckout, startedByCheckout } from "../../lib/payments/checkout"
import { callbackSignature, iyzicoApi } from "../../lib/payments/iyzico"
import { pendingReferenceOf } from "../../lib/payments/pending-refund"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import { isRecordedForRefund, storedIyzicoAccount, storedPaymentSettings } from "./account"
import { refundIyzicoPayment } from "./refund"
import { iyzicoSession, paymentFactsOf, resultMatches } from "./session"

/**
 * Where iyzico sends the shopper's browser with the form's token (our
 * callback route), signed so the route answers only addresses we gave out
 * before it looks anything up or asks iyzico.
 */
export const iyzicoCallbackUrl = (sessionId: string, secretKey: string): string =>
  `${backendUrl()}/hooks/iyzico/callback?session=${encodeURIComponent(sessionId)}&sig=${callbackSignature(secretKey, sessionId)}`

/**
 * iyzico's Checkout Form as a Medusa payment provider (`pp_iyzico_iyzico`,
 * adr/0026). A session starts only from our Store route, which builds the
 * buyer and the basket on the server; it keeps the token, our references,
 * the expected amount, test mode and where the shopper returns, nothing
 * personal. Authorization asks iyzico for the form's result: a payment
 * that matches and passed the fraud check is `captured` (iyzico charges at
 * once); one under review stays `pending`. Refunds go by item transaction,
 * each part recorded before it is sent (`refund.ts`).
 */
class IyzicoProviderService extends AbstractPaymentProvider {
  static override identifier = "iyzico"

  // Public: Medusa builds it with the module's cradle; tests build it directly
  constructor(cradle: Record<string, unknown>, options: Record<string, unknown> = {}) {
    super(cradle, options)
  }

  private async account(): Promise<IyzicoCredentials> {
    const account = await storedIyzicoAccount()
    if (!account) {
      throw new ValidationError("iyzico.not_configured")
    }
    return account
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // Medusa's own session route passes the shopper's `data` and no context: refused
    if (!startedByCheckout(input.context)) {
      throw new ValidationError("payments.use_checkout_route")
    }
    const sessionId = input.data?.["session_id"]
    const checkout = hostedCheckout.safeParse(input.data?.["checkout"])
    if (typeof sessionId !== "string" || !checkout.success) {
      throw new ValidationError("payments.checkout_invalid")
    }
    const amount = fromMedusaAmount(input.amount, { allowRounding: true })
    // The route built both from the same cart: a gap means the cart changed
    if (sumKurus(checkout.data.basket.map((line) => kurus(line.amount))) !== amount) {
      throw new ValidationError("payments.cart_changed")
    }
    const settings = await storedPaymentSettings()
    const account = await this.account()
    const form = await iyzicoApi().initializeCheckoutForm(account, {
      sessionId,
      amount,
      currencyCode: input.currency_code,
      checkout: checkout.data,
      callbackUrl: iyzicoCallbackUrl(sessionId, account.secretKey),
      installments: { enabled: settings.installments_enabled, max: settings.max_installment },
    })
    return {
      id: sessionId,
      status: "pending",
      data: {
        // The buyer and the basket the route sent: a session's data is public
        checkout: null,
        conversation_id: sessionId,
        token: form.token,
        form_url: form.pageUrl,
        amount,
        currency_code: input.currency_code,
        test_mode: account.testMode,
        return_urls: checkout.data.return_urls,
        expires_at: form.expiresAt.toISOString(),
      },
    }
  }

  /** The form's result against what the session expected, with the payment's facts when paid. */
  private async check(
    data: Record<string, unknown> | undefined
  ): Promise<{ status: PaymentSessionStatus; data: Record<string, unknown> }> {
    const session = iyzicoSession(data)
    const result = await iyzicoApi().retrieveCheckoutForm(await this.account(), {
      conversationId: session.conversation_id,
      token: session.token,
    })
    // Nothing paid with the form yet, or a card refused: the shopper may try again
    if (!result?.paid) {
      return { status: "pending", data: data ?? {} }
    }
    const facts = { ...data, ...paymentFactsOf(result) }
    // Recorded to be given back (security review): never an order, however the cart is completed
    const recorded = result.paymentId !== null && (await isRecordedForRefund(result.paymentId))
    if (recorded || !resultMatches(session, result) || result.fraudStatus === -1) {
      return { status: "error", data: facts }
    }
    // Under iyzico's fraud review (0): not an order to ship until approved
    return { status: result.fraudStatus === 1 ? "captured" : "pending", data: facts }
  }

  authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return this.check(input.data)
  }

  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return this.check(input.data)
  }

  // iyzico takes the money when the shopper pays: nothing is left to capture
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  // A form's token cannot be withdrawn; it lapses after 30 minutes. Never throws (adr/0026)
  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  // A new amount means a new form: the shopper starts the payment again
  updatePayment(): Promise<UpdatePaymentOutput> {
    return Promise.reject(new ValidationError("payments.restart_checkout"))
  }

  /**
   * Gives back `amount` by item transaction (F5 V10), under the reference
   * our order refund named in the payment's data (`pending_refund`); a
   * refund of Medusa's own (no such reference) is refused.
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const amount = fromMedusaAmount(input.amount, { allowRounding: true })
    const reference = pendingReferenceOf(input.data, amount)
    if (!reference) {
      throw new ValidationError("payments.use_order_refund")
    }
    return {
      data: await refundIyzicoPayment(
        await this.account(),
        input.data,
        amount,
        reference,
        input.context?.idempotency_key
      ),
    }
  }

  /**
   * Nothing to do, as with PayTR: every payment is captured at once, and
   * Medusa gives a captured payment back through `refundPayment`.
   */
  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  // Results come to our own callback route, /hooks/iyzico/callback (adr/0026 §5)
  getWebhookActionAndData(): Promise<WebhookActionResult> {
    return Promise.resolve({ action: PaymentActions.NOT_SUPPORTED })
  }
}

export default IyzicoProviderService
