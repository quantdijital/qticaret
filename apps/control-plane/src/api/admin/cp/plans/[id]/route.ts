import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { changePackage } from "../changes"
import type { PostPlanUpdateType } from "../validators"

/**
 * POST /admin/cp/plans/:id (owner, finance): a package's name, trial and
 * grace days and limits; its price apart (`/price`, a step-up). Shops on
 * it get the new limits with their next plan document (C9).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostPlanUpdateType>,
  res: MedusaResponse
): Promise<void> {
  const { limits, ...fields } = req.validatedBody
  await changePackage(req, res, { fields, ...(limits ? { limits } : {}) })
}
