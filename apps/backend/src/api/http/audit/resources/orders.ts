import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { fromMedusaAmount, sumKurus } from "../../../../lib/money"
import { RETURN_REQUESTS_MODULE } from "../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../modules/return-requests/service"
import { readOrderMoney } from "../../../../workflows/orders/order-money"
import type { AuditedResource } from "../types"

/**
 * Money given back on an order (F5 V5): what it had refunded and could
 * still give back, before and after, in kuruş; and a return request's
 * state where staff take an approval back. Nothing personal.
 */
export const ORDER_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/orders/:id/refunds",
    pattern: /^\/admin\/orders\/(?<id>order_[A-Za-z0-9]+)\/refunds$/i,
    resourceType: "order",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const money = await readOrderMoney(scope as unknown as MedusaContainer, params["id"] ?? "")
      return { refunded: money.refunded, refundable: money.refundable }
    },
  },
  // F6 W2: a bank transfer's money confirmed; the order's paid total before and after
  {
    method: "POST",
    route: "POST /admin/orders/:id/bank-transfer/confirm",
    pattern: /^\/admin\/orders\/(?<id>order_[A-Za-z0-9]+)\/bank-transfer\/confirm$/i,
    resourceType: "order",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const money = await readOrderMoney(scope as unknown as MedusaContainer, params["id"] ?? "")
      return { paid: money.paid }
    },
  },
  // An approved return taken back (order #691): its status and Medusa's return, before and after
  {
    method: "POST",
    route: "POST /admin/return-requests/:id/cancel",
    pattern: /^\/admin\/return-requests\/(?<id>rreq_[A-Za-z0-9]+)\/cancel$/i,
    resourceType: "return_request",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const [request] = await (scope as unknown as MedusaContainer)
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .listReturnRequests(
          { id: params["id"] ?? "" },
          { select: ["status", "return_id", "exchange_id", "canceled_by", "cancel_cause"], take: 1 }
        )
      return request
        ? {
            status: request.status,
            return_id: request.return_id,
            exchange_id: request.exchange_id,
            canceled_by: request.canceled_by,
            cancel_cause: request.cancel_cause,
          }
        : {}
    },
  },
  // Cash on delivery collected (adr/0029): Medusa's capture; what the payment took, before and after
  {
    method: "POST",
    route: "POST /admin/payments/:id/capture",
    pattern: /^\/admin\/payments\/(?<id>pay_[A-Za-z0-9]+)\/capture$/i,
    resourceType: "payment",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const [payment] = await (scope as unknown as MedusaContainer)
        .resolve(Modules.PAYMENT)
        .listPayments(
          { id: params["id"] ?? "" },
          { select: ["id", "provider_id"], relations: ["captures"] }
        )
      return payment
        ? {
            provider_id: payment.provider_id,
            captured: sumKurus(
              (payment.captures ?? []).map((capture) =>
                fromMedusaAmount(capture.raw_amount ?? capture.amount, { allowRounding: true })
              )
            ),
          }
        : {}
    },
  },
]
