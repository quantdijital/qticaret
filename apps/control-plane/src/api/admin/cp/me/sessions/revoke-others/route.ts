import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cpStaff } from "../../../../../http/caller"
import { endAllSessions } from "../../../../../http/sessions"

/**
 * POST /admin/cp/me/sessions/revoke-others (step-up, or a sign-in with a
 * code in the last five minutes, M2): ends every session of the member
 * but this one, and every bearer token they hold (a bearer request has no
 * session of its own: all of them end).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const userId = req.auth_context.actor_id
  const ended = await endAllSessions(req, userId, { keepCurrent: true })
  await cpStaff(req).endTokens(userId)
  res.json({ ended })
}
