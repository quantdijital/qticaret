import type { MedusaContainer } from "@medusajs/framework/types"
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
]
