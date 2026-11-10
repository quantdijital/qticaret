import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { openSessions } from "../../../../http/sessions"

/**
 * GET /admin/cp/me/sessions: the member's own open panel sessions, each by
 * a handle (a keyed hash of its id, never the id), its expiry, and whether
 * it is this one. A bearer token is no session and is not listed.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const open = await openSessions(req, req.auth_context.actor_id)
  res.json({
    sessions: open.map((each) => ({
      id: each.handle,
      expires_at: new Date(each.expiresAt).toISOString(),
      current: each.current,
    })),
  })
}
