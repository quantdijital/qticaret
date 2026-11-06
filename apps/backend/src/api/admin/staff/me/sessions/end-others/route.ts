import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { endOtherSessions } from "../../../../../http/staff-sessions"

/**
 * POST /admin/staff/me/sessions/end-others (the owner, 2026-11-06): the
 * signed-in member signs out everywhere but here: a computer left signed
 * in, a session they do not recognise. Their own sessions only.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ ended: await endOtherSessions(req, req.auth_context.actor_id) })
}
