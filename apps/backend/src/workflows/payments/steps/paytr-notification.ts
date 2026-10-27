import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import { WEBHOOK_EVENTS_MODULE } from "../../../modules/webhook-events"
import type { ClaimState } from "../../../modules/webhook-events/service"
import type WebhookEventsModuleService from "../../../modules/webhook-events/service"

export interface PaytrNotification {
  merchant_oid: string
  status: "success" | "failed"
  /** Kuruş PayTR charged, surcharge included. */
  total_amount: number
  test_mode: boolean
  failed_reason_code: string | null
}

/** Our session behind PayTR's reference (adr/0026 §3), and the cart it pays; null when not ours. */
export const findPaytrSessionStep = createStep(
  "payments-find-paytr-session",
  async (merchantOid: string, { container }) => {
    // The reference is the session id without its underscore: `payses01J…`
    const sessionId = /^payses[0-9A-Z]{20,40}$/.test(merchantOid)
      ? `payses_${merchantOid.slice("payses".length)}`
      : null
    if (!sessionId) {
      return new StepResponse(null)
    }
    const [session] = await container
      .resolve(Modules.PAYMENT)
      .listPaymentSessions(
        { id: sessionId },
        { select: ["id", "provider_id", "payment_collection_id", "data"] }
      )
    if (
      session?.provider_id !== PAYTR_PAYMENT_PROVIDER_ID ||
      session.data["merchant_oid"] !== merchantOid
    ) {
      return new StepResponse(null)
    }
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "payment_collection",
      fields: ["cart.id"],
      filters: { id: session.payment_collection_id },
    })
    const cartId = (data[0] as { cart?: { id: string } | null } | undefined)?.cart?.id
    return new StepResponse(cartId ? { session_id: session.id, cart_id: cartId } : null)
  }
)

export interface PaytrClaim {
  id: string | null
  state: ClaimState | "not_ours"
  cart_id: string | null
}

/**
 * Records the notification before it is handled, once per reference and
 * status. If a later step fails, the record is marked failed (the error's
 * code only) and PayTR, not answered "OK", sends it again.
 */
export const claimPaytrNotificationStep = createStep(
  "payments-claim-paytr-notification",
  async (
    input: { notification: PaytrNotification; target: { cart_id: string } | null },
    { container }
  ) => {
    if (!input.target) {
      return new StepResponse<PaytrClaim, string | null>(
        { id: null, state: "not_ours", cart_id: null },
        null
      )
    }
    const { notification } = input
    const claim = await container
      .resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
      .claim("paytr", `${notification.merchant_oid}:${notification.status}`, {
        merchant_oid: notification.merchant_oid,
        status: notification.status,
        total_amount: notification.total_amount,
        test_mode: notification.test_mode,
        failed_reason_code: notification.failed_reason_code,
      })
    const handling = claim.state === "new" || claim.state === "retry"
    return new StepResponse<PaytrClaim, string | null>(
      { ...claim, cart_id: input.target.cart_id },
      handling ? claim.id : null
    )
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
        .markFailed(id, "processing_failed")
    }
  }
)

export const markPaytrNotificationStep = createStep(
  "payments-mark-paytr-notification",
  async (input: { claim: PaytrClaim; order_id: string | null }, { container }) => {
    const { claim } = input
    if (claim.id && (claim.state === "new" || claim.state === "retry")) {
      await container
        .resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
        .markProcessed(claim.id, input.order_id ? { order_id: input.order_id } : undefined)
    }
    return new StepResponse(null)
  }
)
