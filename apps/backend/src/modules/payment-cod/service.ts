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
import { startedByCheckout } from "../../lib/payments/checkout"

/**
 * Cash on delivery as a Medusa payment provider (`pp_cod_cod`, adr/0029).
 * It calls no outside service. The order is placed with the payment
 * authorized: the courier collects it at the door, and the shop captures it
 * once the money is reported (by hand now, by the courier's report in F7).
 * Whether the cart may be paid so, and its fee, our start route decides.
 */
class CashOnDeliveryProviderService extends AbstractPaymentProvider {
  static override identifier = "cod"

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
    const fee = input.data?.["fee"]
    if (typeof sessionId !== "string" || typeof fee !== "number") {
      return Promise.reject(new ValidationError("payments.checkout_invalid"))
    }
    return Promise.resolve({
      id: sessionId,
      status: "pending",
      data: {
        method: "cash_on_delivery",
        amount: fromMedusaAmount(input.amount, { allowRounding: true }),
        currency_code: input.currency_code,
        fee,
      },
    })
  }

  // The order is placed; the money comes at the door
  authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return Promise.resolve({ status: "authorized", data: input.data ?? {} })
  }

  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return Promise.resolve({ status: "authorized", data: input.data ?? {} })
  }

  // The courier collected it: capturing records it, nothing is sent anywhere
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  // Not delivered, or refused at the door: nothing was taken
  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  updatePayment(): Promise<UpdatePaymentOutput> {
    return Promise.reject(new ValidationError("payments.restart_checkout"))
  }

  /** The shop pays the customer back itself: the refund here is the record of it. */
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} })
  }

  getWebhookActionAndData(): Promise<WebhookActionResult> {
    return Promise.resolve({ action: PaymentActions.NOT_SUPPORTED })
  }
}

export default CashOnDeliveryProviderService
