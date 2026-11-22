import { validateAndTransformBody } from "@medusajs/framework/http"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { isCheckoutProvider } from "../../lib/payments/checkout"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { cancelGiftCardsWorkflow } from "../../workflows/orders/cancel-gift-cards"
import {
  AdminPostOrderRefund,
  AdminPostOrderRefundPreview,
  AdminPostOrderRefundSettle,
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
 * Medusa's capture of part of a payment (`amount`) refused for the ways
 * our checkout starts (a bank transfer, cash on delivery, a hosted card
 * form): the panel captures the whole payment, and a partial capture
 * leaves `captured_at` empty, money taken that code reading it would miss
 * (refund safety follow-up of adr/0076). The amount is never the
 * client's to set for these; the system provider goes on as before.
 */
export async function refusePartialCapture(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const amount = (req.body as { amount?: unknown } | undefined)?.amount
  if (req.method !== "POST" || amount === undefined || amount === null) {
    next()
    return
  }
  try {
    const [payment] = await req.scope
      .resolve(Modules.PAYMENT)
      .listPayments({ id: req.params["id"] ?? "" }, { select: ["provider_id"] })
    next(
      isCheckoutProvider(payment?.provider_id)
        ? new ValidationError("payments.partial_capture_refused", { field: "amount" })
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
    // One refund per payment (an edit's collected difference is a payment of its own)
    await cancelGiftCardsWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        refund: {
          note: "order canceled",
          created_by: (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id ?? null,
        },
      },
    })
    next()
  } catch (error) {
    next(error)
  }
}

// Each refund asks the provider: a budget per address and per staff member
export const refundLimit = rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
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
  // An open refund checked at the provider (review 2026-11-17, O2): staff with the refund's rights
  {
    matcher: "/admin/orders/:id/refunds/:reference/settle",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      refundLimit,
      validateAndTransformBody(AdminPostOrderRefundSettle),
    ],
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
  // The whole payment only, for our checkout's ways (no `methods`, as above)
  {
    matcher: "/admin/payments/:id/capture",
    middlewares: [requireUserActor, refusePartialCapture],
  },
  { matcher: "/admin/orders/:id/cancel", middlewares: [holdCancelLocks, refundBeforeCancel] },
]
