import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { changePackage } from "../../changes"

/** POST /admin/cp/plans/:id/restore (owner, finance): an archived package offered again. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await changePackage(req, res, { fields: { archived_at: null } })
}
