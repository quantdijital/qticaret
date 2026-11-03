import { validateAndTransformBody } from "@medusajs/framework/http"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { kurus } from "../../lib/money"
import { cancelRefundReference } from "../../lib/orders/locks"
import { isCheckoutProvider } from "../../lib/payments/checkout"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { cancelGiftCardsWorkflow } from "../../workflows/orders/cancel-gift-cards"
import { readOrderMoney } from "../../workflows/orders/order-money"
import { paymentRemainders } from "../../workflows/orders/steps/order-refund"
import type { RefundOrderInput } from "../../workflows/orders/steps/order-refund"
import {
  AdminPostOrderRefund,
  AdminPostOrderRefundPreview,
} from "../admin/orders/[id]/refunds/validators"
import { requireUserActor } from "./actor"
import { holdCancelLocks } from "./bank-transfer-routes"
import { rateLimit } from "./rate-limit"

/** Medusa's own payment refund: a payment our route started is given back line by line, through ours. */
async function refuseHostedPaymentRefund(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const [payment] = await req.scope
      .resolve(Modules.PAYMENT)
      .listPayments({ id: req.params["id"] ?? "" }, { select: ["provider_id"] })
    next(
      isCheckoutProvider(payment?.provider_id)
        ? new ValidationError("payments.use_order_refund")
        : undefined
    )
  } catch (error) {
    next(error)
  }
}

/**
 * Medusa's cancel gives a captured payment back but goes on when the
 * refund fails, leaving the order cancelled and the money kept. An order
 * Medusa would cancel is refunded through ours first, under a reference of
 * its own (tried again, refunded once); a refund that fails stops the
 * cancel with the provider's reason. Gift cards the order sent are voided
 * first, and a card used refuses the cancel (`cancelGiftCardsWorkflow`,
 * adr/0025 2026-11-03), as for the shopper's own cancel.
 */
async function refundBeforeCancel(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  const orderId = req.params["id"] ?? ""
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["status", "fulfillments.canceled_at"],
      filters: { id: orderId },
    })
    const order = data[0] as
      { status?: string; fulfillments?: ({ canceled_at?: unknown } | null)[] | null } | undefined
    const cancellable =
      order !== undefined &&
      order.status !== "canceled" &&
      order.status !== "completed" &&
      (order.fulfillments ?? []).every((fulfillment) => fulfillment?.canceled_at)
    // Not one Medusa would cancel: its own answer says why, and nothing is refunded
    if (!cancellable) {
      next()
      return
    }
    await cancelGiftCardsWorkflow(req.scope).run({
      input: { order_id: orderId, refunds: await cancelRefunds(req, orderId) },
    })
    next()
  } catch (error) {
    next(error)
  }
}

/** One refund per payment: an edit's collected difference is a payment of its own. */
async function cancelRefunds(req: MedusaRequest, orderId: string): Promise<RefundOrderInput[]> {
  let left = (await readOrderMoney(req.scope, orderId)).refundable
  const payments = (await paymentRemainders(req.scope, orderId)).filter(
    (payment) => payment.remaining > 0
  )
  const refunds: RefundOrderInput[] = []
  for (const [part, payment] of payments.entries()) {
    const amount = Math.min(left, payment.remaining)
    if (amount <= 0) {
      break
    }
    refunds.push({
      order_id: orderId,
      reference: cancelRefundReference(orderId, part),
      request: { amount: kurus(amount) },
      note: "order canceled",
      created_by: (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id ?? null,
    })
    left = kurus(left - amount)
  }
  return refunds
}

// Each refund asks the provider: a budget per address and per staff member
const refundLimit = rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
  identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
})

/** F5 V5: money back on an order, line by line, through our flow only. */
export const ORDER_REFUND_ROUTES = [
  {
    matcher: "/admin/orders/:id/refunds/preview",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostOrderRefundPreview)],
  },
  {
    matcher: "/admin/orders/:id/refunds",
    methods: ["POST" as const],
    middlewares: [requireUserActor, refundLimit, validateAndTransformBody(AdminPostOrderRefund)],
  },
  // Card brand and last four digits, asked of PayTR: staff only
  {
    matcher: "/admin/orders/:id/payment-details",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  // No `methods` on purpose: a method-scoped middleware may sort after the core route
  { matcher: "/admin/payments/:id/refund", middlewares: [refuseHostedPaymentRefund] },
  // Cash on delivery's "collected" (adr/0029): Medusa's capture, by staff only
  { matcher: "/admin/payments/:id/capture", middlewares: [requireUserActor] },
  { matcher: "/admin/orders/:id/cancel", middlewares: [holdCancelLocks, refundBeforeCancel] },
]
