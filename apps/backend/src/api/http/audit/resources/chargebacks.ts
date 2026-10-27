import type { MedusaContainer } from "@medusajs/framework/types"
import { CHARGEBACKS_MODULE } from "../../../../modules/chargebacks"
import type ChargebacksModuleService from "../../../../modules/chargebacks/service"
import type { AuditedResource } from "../types"

/** Disputes recorded and moved on (F6.7, adr/0030): their state before and after. */
export const CHARGEBACK_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/chargebacks",
    pattern: /^\/admin\/chargebacks$/i,
    resourceType: "chargeback",
    resourceId: () => null,
    // The order's disputes before and after: the new one shows as added
    snapshot: async ({ scope, body }) => {
      const orderId = (body as { order_id?: unknown } | null)?.order_id
      if (typeof orderId !== "string") {
        return {}
      }
      const chargebacks = await (scope as unknown as MedusaContainer)
        .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
        .listChargebacks(
          { order_id: orderId },
          { take: 20, select: ["id", "status", "amount", "reason"], order: { created_at: "DESC" } }
        )
      return Object.fromEntries(
        chargebacks.flatMap((chargeback): [string, unknown][] => [
          [`${chargeback.id}.status`, chargeback.status],
          [`${chargeback.id}.amount`, chargeback.amount],
          [`${chargeback.id}.reason`, chargeback.reason],
        ])
      )
    },
  },
  {
    method: "POST",
    route: "POST /admin/chargebacks/:id",
    pattern: /^\/admin\/chargebacks\/(?<id>chbk_[A-Za-z0-9]+)$/i,
    resourceType: "chargeback",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const [chargeback] = await (scope as unknown as MedusaContainer)
        .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
        .listChargebacks({ id: params["id"] ?? "" }, { take: 1, select: ["status", "amount"] })
      return chargeback ? { status: chargeback.status, amount: chargeback.amount } : {}
    },
  },
]
