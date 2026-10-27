import { container } from "@medusajs/framework"
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
import { fromMedusaAmount } from "../../lib/money"
import { HOSTED_CHECKOUT } from "../../lib/payments/checkout"
import { bankTransferSettings } from "../../lib/payments/settings"

/** A session the shop confirmed: the money came (W2's confirmation writes it). */
const statusOf = (data: Record<string, unknown> | undefined): PaymentSessionStatus =>
  typeof data?.["confirmed_at"] === "string" ? "captured" : "pending_authorization"

/**
 * Bank transfer as a Medusa payment provider (`pp_bank-transfer_bank-transfer`,
 * adr/0029). It calls no outside service. A session keeps the amount and
 * the shop's account, which the shopper sees (public by intent). At
 * completion it answers `pending_authorization`: Medusa places the order
 * "awaiting payment", with no payment yet. Once the shop confirms the
 * money, authorizing again answers `captured`.
 */
class BankTransferProviderService extends AbstractPaymentProvider {
  static override identifier = "bank-transfer"

  // Public: Medusa builds it with the module's cradle; tests build it directly
  constructor(cradle: Record<string, unknown>, options: Record<string, unknown> = {}) {
    super(cradle, options)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // Medusa's own session route passes no context of ours: refused
    if ((input.context as Record<string, unknown> | undefined)?.[HOSTED_CHECKOUT] !== true) {
      throw new ValidationError("payments.use_checkout_route")
    }
    const sessionId = input.data?.["session_id"]
    if (typeof sessionId !== "string") {
      throw new ValidationError("payments.checkout_invalid")
    }
    const bank = await bankTransferSettings(container)
    if (!bank.enabled || !bank.iban) {
      throw new ValidationError("bank_transfer.not_configured")
    }
    return {
      id: sessionId,
      status: "pending",
      data: {
        method: "bank_transfer",
        amount: fromMedusaAmount(input.amount, { allowRounding: true }),
        currency_code: input.currency_code,
        account_holder: bank.account_holder,
        bank_name: bank.bank_name,
        iban: bank.iban,
        deadline_hours: bank.deadline_hours,
      },
    }
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

  // A new amount is a new start: the shopper picks the method again
  updatePayment(): Promise<UpdatePaymentOutput> {
    return Promise.reject(new ValidationError("payments.restart_checkout"))
  }

  /**
   * The shop sends the money back from its own bank: the refund here is the
   * record of it (our order refund names it; nothing is sent anywhere).
   */
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  getWebhookActionAndData(): Promise<WebhookActionResult> {
    return Promise.resolve({ action: PaymentActions.NOT_SUPPORTED })
  }
}

export default BankTransferProviderService
