import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { fromMedusaAmount, sumKurus } from "../../../../lib/money"
import { readOrderMoney } from "../../../../workflows/orders/order-money"
import type { AuditedResource } from "../types"

/**
 * Money given back on an order (F5 V5): what it had refunded and could
 * still give back, before and after, in kuruş. Nothing personal.
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
