import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cpStaff } from "../../../../../../http/caller"
import { memberParam } from "../../member-param"

/** POST /admin/cp/staff/members/:id/reactivate (owner, step-up): access back, with the old role. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await memberParam(req)
  await cpStaff(req).reactivate(id)
  res.json({ member: { id, active: (await cpStaff(req).roleOf(id)) !== null } })
}
