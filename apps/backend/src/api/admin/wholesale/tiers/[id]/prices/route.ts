import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fromMedusaAmount } from "../../../../../../lib/money"
import { setManualPricesWorkflow } from "../../../../../../workflows/wholesale/manual-prices"
import type { AdminPostWholesalePricesType } from "../../../validators"
import { tierOf } from "../../../view"

/**
 * `POST /admin/wholesale/tiers/:id/prices` (ADR-0068 §4): prices entered
 * by hand, KDV excluded, kept as entered and written to the level's list
 * with each variant's KDV; removed ones fall back to the rate.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostWholesalePricesType>,
  res: MedusaResponse
): Promise<void> {
  const tier = await tierOf(req)
  const { result } = await setManualPricesWorkflow(req.scope).run({
    input: {
      list: {
        kind: "level",
        price_list_id: tier.price_list_id,
        customer_group_id: tier.customer_group_id,
        rate_bps: tier.rate_bps ?? null,
      },
      set: req.validatedBody.set.map((each) => ({
        variant_id: each.variant_id,
        net_amount: fromMedusaAmount(each.net),
      })),
      remove: req.validatedBody.remove,
      created_by: req.auth_context.actor_id || null,
    },
  })
  res.json(result)
}
