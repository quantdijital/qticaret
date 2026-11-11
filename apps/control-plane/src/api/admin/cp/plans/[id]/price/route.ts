import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { changePackage } from "../../changes"
import type { PostPlanPriceType } from "../../validators"

/**
 * POST /admin/cp/plans/:id/price (owner, finance, step-up: adr/0061 §3.5):
 * a package's price in kuruş and its period. It applies from each shop's
 * next period on, with no proration (§7). Recorded from and to.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostPlanPriceType>,
  res: MedusaResponse
): Promise<void> {
  await changePackage(req, res, { fields: req.validatedBody })
}
