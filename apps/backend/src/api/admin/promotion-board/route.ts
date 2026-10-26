import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { promotionBoard } from "../../../workflows/promotions/code-batch-reads"

// The fields the panel's list shows (as `GET /admin/promotions` would return them)
const FIELDS = [
  "id",
  "code",
  "status",
  "is_automatic",
  "type",
  "limit",
  "used",
  "created_at",
  "application_method.id",
  "application_method.type",
  "application_method.target_type",
  "application_method.value",
  "application_method.currency_code",
  "application_method.apply_to_quantity",
  "application_method.buy_rules_min_quantity",
  "campaign.id",
  "campaign.starts_at",
  "campaign.ends_at",
]
// A shop runs a handful at a time: one read holds them
const TAKE = 200

/**
 * `GET /admin/promotion-board` (F4.6): the shop's promotions without the
 * copies single-use code batches hold, and each template's batch count.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await promotionBoard(req.scope, FIELDS, TAKE))
}
