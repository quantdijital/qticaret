import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fromMedusaAmount } from "../../../../../../lib/money"
import { setManualPricesWorkflow } from "../../../../../../workflows/wholesale/manual-prices"
import { ownListOf } from "../../../account-view"
import type { AdminPostWholesalePricesType } from "../../../validators"

/**
 * `POST /admin/wholesale/accounts/:id/prices` (ADR-0068 §4): the
 * wholesaler's own prices entered by hand, KDV excluded, as a level's
 * are; each row carries the account's hidden group as a price rule (Ek
 * 2026-11-15), so it outranks the level. 409 without an own list.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostWholesalePricesType>,
  res: MedusaResponse
): Promise<void> {
  const list = await ownListOf(req)
  const { result } = await setManualPricesWorkflow(req.scope).run({
    input: {
      list,
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
