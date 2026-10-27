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
    // A new record: nothing before it
    snapshot: () => Promise.resolve({}),
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
