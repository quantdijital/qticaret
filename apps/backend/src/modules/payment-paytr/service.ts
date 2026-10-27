import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
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
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { AbstractPaymentProvider, PaymentActions } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount, kurus } from "../../lib/money"
import { HOSTED_CHECKOUT } from "../../lib/payments/checkout"
import { paytrApi, paytrFormUrl } from "../../lib/payments/paytr"
import type { PaytrCredentials } from "../../lib/payments/paytr"
import { storedPaytrAccount } from "./account"
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
 * so an accepted payment is `captured`. Refunds and cancels come in F5 V5.
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
    if ((input.context as Record<string, unknown> | undefined)?.[HOSTED_CHECKOUT] !== true) {
      throw new ValidationError("payments.use_checkout_route")
    }
    const amount = fromMedusaAmount(input.amount, { allowRounding: true })
    const request = tokenRequestOf(input.data, amount, input.currency_code)
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

  /** What PayTR holds for the session, against what the session expected. */
  private async statusOf(data: Record<string, unknown> | undefined): Promise<PaymentSessionStatus> {
    const session = paytrSession(data)
    const paid = await paytrApi().queryStatus(await this.account(), session.merchant_oid)
    if (!paid) {
      return "pending"
    }
    const matches =
      paid.paymentAmount === kurus(session.amount) &&
      paid.currencyCode === session.currency_code &&
      paid.testMode === session.test_mode
    return matches ? "captured" : "error"
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return { status: await this.statusOf(input.data), data: input.data ?? {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return { status: await this.statusOf(input.data), data: input.data ?? {} }
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

  refundPayment(): Promise<RefundPaymentOutput> {
    return Promise.reject(new ValidationError("paytr.refund_unavailable"))
  }

  cancelPayment(): Promise<CancelPaymentOutput> {
    return Promise.reject(new ValidationError("paytr.refund_unavailable"))
  }

  // Notifications come to our own route, /hooks/paytr (adr/0026 §5), not Medusa's
  getWebhookActionAndData(): Promise<WebhookActionResult> {
    return Promise.resolve({ action: PaymentActions.NOT_SUPPORTED })
  }
}

export default PaytrProviderService
