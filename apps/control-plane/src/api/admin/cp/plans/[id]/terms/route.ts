import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { changePackage } from "../../changes"
import type { PostPlanTermsType } from "../../validators"

/**
 * POST /admin/cp/plans/:id/terms (owner, finance, step-up: adr/0061 Ek C19
 * L1): a package's trial and grace days. They decide when a shop is
 * charged and when it is restricted, so they ask the proof the price and
 * one shop's grace days ask. Recorded from and to.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostPlanTermsType>,
  res: MedusaResponse
): Promise<void> {
  await changePackage(req, res, { fields: req.validatedBody })
}
