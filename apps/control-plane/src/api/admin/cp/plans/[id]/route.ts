import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { changePackage } from "../changes"
import type { PostPlanUpdateType } from "../validators"

/**
 * POST /admin/cp/plans/:id (owner, finance): a package's name, limits and
 * flags; its price (`/price`) and its trial and grace days (`/terms`)
 * apart, each a step-up (Ek C19 L1). Shops on it get the new limits with
 * their next plan document (C9).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostPlanUpdateType>,
  res: MedusaResponse
): Promise<void> {
  const { limits, features, ...fields } = req.validatedBody
  await changePackage(req, res, {
    fields,
    ...(limits ? { limits } : {}),
    ...(features ? { features } : {}),
  })
}
