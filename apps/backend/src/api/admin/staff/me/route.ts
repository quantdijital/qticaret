import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { capabilitiesOf } from "../../../../lib/staff"
import { staffRoleOf } from "../../../http/staff-guard"

/**
 * GET /admin/staff/me (F12.6, adr/0040): the signed-in staff member's role
 * and what the panel may offer them. The API decides again on every request.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const role = (await staffRoleOf(req)) ?? null
  res.json({
    user_id: req.auth_context.actor_id,
    role,
    can: capabilitiesOf(role),
  })
}
