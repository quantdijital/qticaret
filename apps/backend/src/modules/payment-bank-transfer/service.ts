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
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { AbstractPaymentProvider, PaymentActions } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount } from "../../lib/money"
import { startedByCheckout } from "../../lib/payments/checkout"
import { recordedRefund } from "../../lib/payments/pending-refund"

const accountOf = (data: Record<string, unknown> | undefined) => {
  const account = data?.["account"] as Record<string, unknown> | undefined
  const text = (key: string) => (typeof account?.[key] === "string" ? account[key] : null)
  const hours = account?.["deadline_hours"]
  return text("iban") && text("account_holder") && typeof hours === "number"
    ? {
        account_holder: text("account_holder"),
        bank_name: text("bank_name"),
        iban: text("iban"),
        deadline_hours: hours,
      }
    : null
}

/**
 * A session the shop confirmed (the money came) authorizes, and the
 * confirmation captures it; until then the order awaits the money.
 */
const statusOf = (data: Record<string, unknown> | undefined): PaymentSessionStatus =>
  typeof data?.["confirmed_at"] === "string" ? "authorized" : "pending_authorization"

/**
 * Bank transfer as a Medusa payment provider (`pp_bank-transfer_bank-transfer`,
 * adr/0029). It calls no outside service and reads no other module: our
 * start workflow gives it the shop's account. A session keeps the amount
 * and the account, which the shopper sees (public by intent). At
 * completion it answers `pending_authorization`: Medusa places the order
 * "awaiting payment", with no payment yet. The shop's confirmation writes
 * itself into the session (the one update allowed), authorizes it again
 * and captures it (`confirmBankTransferWorkflow`).
 */
class BankTransferProviderService extends AbstractPaymentProvider {
  static override identifier = "bank-transfer"

  // Public: Medusa builds it with the module's cradle; tests build it directly
  constructor(cradle: Record<string, unknown>, options: Record<string, unknown> = {}) {
    super(cradle, options)
  }

  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // Medusa's own session route passes no context of ours: refused
    if (!startedByCheckout(input.context)) {
      return Promise.reject(new ValidationError("payments.use_checkout_route"))
    }
    const sessionId = input.data?.["session_id"]
    const account = accountOf(input.data)
    if (typeof sessionId !== "string" || !account) {
      return Promise.reject(new ValidationError("payments.checkout_invalid"))
    }
    return Promise.resolve({
      id: sessionId,
      status: "pending",
      data: {
        method: "bank_transfer",
        amount: fromMedusaAmount(input.amount, { allowRounding: true }),
        currency_code: input.currency_code,
        ...account,
      },
    })
  }

  authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return Promise.resolve({ status: statusOf(input.data), data: input.data ?? {} })
  }

  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return Promise.resolve({ status: statusOf(input.data), data: input.data ?? {} })
  }

  // The money is in once the shop confirmed it: nothing is left to capture
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  /**
   * Only the shop's confirmation, for the same amount; anything else is a
   * new start (the shopper picks the method again).
   */
  updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const data = input.data ?? {}
    const confirmed =
      typeof data["confirmed_at"] === "string" &&
      data["amount"] === fromMedusaAmount(input.amount, { allowRounding: true })
    return confirmed
      ? Promise.resolve({ data, status: "pending_authorization" })
      : Promise.reject(new ValidationError("payments.restart_checkout"))
  }

  /**
   * The shop sends the money back from its own bank: the refund here is the
   * record of it (our order refund names it; nothing is sent anywhere),
   * kept in the payment's data under our reference for the ledger.
   */
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return Promise.resolve({ data: recordedRefund(input) })
  }

  getWebhookActionAndData(): Promise<WebhookActionResult> {
    return Promise.resolve({ action: PaymentActions.NOT_SUPPORTED })
  }
}

export default BankTransferProviderService
