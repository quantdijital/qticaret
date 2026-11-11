import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { changePackage } from "../../changes"

/**
 * POST /admin/cp/plans/:id/archive (owner, finance): the package is
 * offered to no new shop. Shops already on it keep it, its limits and its
 * price: archiving one in use is allowed, the panel says how many are on
 * it first (a warning, not a block).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await changePackage(req, res, { fields: { archived_at: new Date() } })
}
