import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { endSessions, openSessions } from "../../../../../http/sessions"

/**
 * POST /admin/cp/me/sessions/revoke-others (step-up): ends every session of
 * the member but this one (a bearer request has none: all of them end).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const userId = req.auth_context.actor_id
  const others = (await openSessions(req, userId)).filter((each) => !each.current)
  const ended = await endSessions(
    req,
    userId,
    others.map((each) => each.sid)
  )
  res.json({ ended })
}
