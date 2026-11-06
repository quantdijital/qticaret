import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { openSessionCount } from "../../../../http/staff-sessions"

/**
 * GET /admin/staff/me/sessions (security review 2026-11-06): how many panel
 * sessions the signed-in member has open, this one counted; null when the
 * server cannot tell. Read from the member's own noted sessions only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ open: await openSessionCount(req, req.auth_context.actor_id) })
}
