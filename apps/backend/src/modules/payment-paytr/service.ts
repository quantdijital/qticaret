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
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount, kurus } from "../../lib/money"
import { startedByCheckout } from "../../lib/payments/checkout"
import { paytrApi, paytrFormUrl } from "../../lib/payments/paytr"
import type { PaytrCredentials } from "../../lib/payments/paytr"
import {
  isRecordedForRefund,
  recoveryRefundReference,
  storedPaymentSettings,
  storedPaytrAccount,
} from "./account"
import {
  ownRefundReferenceOf,
  pendingReferenceOf,
  refundPaytrPayment,
  refundReferenceOf,
} from "./refund"
import { paytrSession, tokenRequestOf } from "./session"

// PayTR keeps an iFrame token this long (`timeout_limit`, minutes)
const TOKEN_MINUTES = 30

/**
 * PayTR's iFrame API as a Medusa payment provider (`pp_paytr_paytr`,
 * adr/0026). A session starts only from our Store route, which builds the
 * buyer and the basket on the server; the session keeps the token, the
 * order reference, the expected amount and currency, test mode and expiry,
 * nothing personal. Authorization asks PayTR again (the status query) and
 * compares what was paid with what was expected; PayTR charges at once,
 * so an accepted payment is `captured`. A refund is made once per
 * reference, however often it is tried (F5 V5).
 */
class PaytrProviderService extends AbstractPaymentProvider {
  static override identifier = "paytr"

  // Public: Medusa builds it with the module's cradle; tests build it directly
  constructor(cradle: Record<string, unknown>, options: Record<string, unknown> = {}) {
    super(cradle, options)
  }

  private async account(): Promise<PaytrCredentials> {
    const account = await storedPaytrAccount()
    if (!account) {
      throw new ValidationError("paytr.not_configured")
    }
    return account
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // Medusa's own session route passes the shopper's `data` and no context: refused
    if (!startedByCheckout(input.context)) {
      throw new ValidationError("payments.use_checkout_route")
    }
    const amount = fromMedusaAmount(input.amount, { allowRounding: true })
    const settings = await storedPaymentSettings()
    const request = tokenRequestOf(input.data, amount, input.currency_code, {
      enabled: settings.installments_enabled,
      max: settings.max_installment,
    })
    const account = await this.account()
    const token = await paytrApi().requestToken(account, {
      ...request,
      timeoutMinutes: TOKEN_MINUTES,
    })
    return {
      id: request.merchantOid,
      status: "pending",
      data: {
        // The buyer and the basket the route sent: a session's data is public
        checkout: null,
        token,
        form_url: paytrFormUrl(token),
        merchant_oid: request.merchantOid,
        amount,
        currency_code: input.currency_code,
        test_mode: account.testMode,
        expires_at: new Date(Date.now() + TOKEN_MINUTES * 60_000).toISOString(),
      },
    }
  }

  /**
   * What PayTR holds for the session, against what the session expected.
   * Authorizing, a payment given back already (by hand, or recorded to be
   * by the recovery job) is never an order (security review 2026-11-16).
   */
  private async statusOf(
    data: Record<string, unknown> | undefined,
    authorizing: boolean
  ): Promise<PaymentSessionStatus> {
    const session = paytrSession(data)
    const paid = await paytrApi().queryStatus(await this.account(), session.merchant_oid)
    if (!paid) {
      return "pending"
    }
    const matches =
      paid.paymentAmount === kurus(session.amount) &&
      paid.currencyCode === session.currency_code &&
      paid.testMode === session.test_mode
    if (!matches) {
      return "error"
    }
    if (
      authorizing &&
      (paid.refunds.some((refund) => refund.amount > 0) ||
        (await isRecordedForRefund(session.merchant_oid)))
    ) {
      return "error"
    }
    return "captured"
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return { status: await this.statusOf(input.data, true), data: input.data ?? {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return { status: await this.statusOf(input.data, false), data: input.data ?? {} }
  }

  // PayTR takes the money when the shopper pays: nothing is left to capture
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  // A PayTR token cannot be changed or withdrawn; it lapses. Never throws (adr/0026)
  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  // A new amount means a new token: the shopper starts the payment again
  updatePayment(): Promise<UpdatePaymentOutput> {
    return Promise.reject(new ValidationError("payments.restart_checkout"))
  }

  /**
   * Gives back `amount` of the payment under a reference that stays the
   * same when the refund is tried again: the one our refund workflow put in
   * the payment's data (`pending_refund`). A refund Medusa asks for on its
   * own (its cart completion's give-back; it always names a key) goes under
   * the payment's, the amount's and its count's reference (Medusa keeps
   * the data this returns), not the key it makes anew for each try, and
   * counts as made when PayTR shows the recovery job's refund of that
   * amount: a retried try (a step, a second run, the job before it) is sent
   * to PayTR once; a second refund of the same amount is sent too.
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const amount = fromMedusaAmount(input.amount, { allowRounding: true })
    const account = await this.account()
    const ours = pendingReferenceOf(input.data, amount)
    if (ours) {
      return {
        data: await refundPaytrPayment(
          account,
          input.data,
          amount,
          refundReferenceOf(ours),
          [],
          input.context?.idempotency_key
        ),
      }
    }
    if (!input.context?.idempotency_key) {
      throw new ValidationError("payments.refund_reference_missing")
    }
    const { merchant_oid } = paytrSession(input.data)
    const job = await recoveryRefundReference(merchant_oid)
    return {
      data: await refundPaytrPayment(
        account,
        input.data,
        amount,
        ownRefundReferenceOf(merchant_oid, amount, input.data),
        job ? [job] : [],
        input.context.idempotency_key
      ),
    }
  }

  /**
   * Nothing to do: PayTR charges at once, so every payment is captured, and
   * Medusa gives a captured payment back through `refundPayment` (an order
   * cancelled, a cart that could not be completed). Medusa calls this only
   * to undo an authorization; refunding here too would refund twice.
   */
  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  // Notifications come to our own route, /hooks/paytr (adr/0026 §5), not Medusa's
  getWebhookActionAndData(): Promise<WebhookActionResult> {
    return Promise.resolve({ action: PaymentActions.NOT_SUPPORTED })
  }
}

export default PaytrProviderService
