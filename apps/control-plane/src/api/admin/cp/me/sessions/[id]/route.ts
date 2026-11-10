import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { endSessions, openSessions } from "../../../../../http/sessions"

/**
 * DELETE /admin/cp/me/sessions/:id (step-up): ends one of the member's own
 * sessions, named by its handle; another member's is never found.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const userId = req.auth_context.actor_id
  const handle = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const session = (await openSessions(req, userId)).find((each) => each.handle === handle)
  if (!session) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.session_unknown")
  }
  const ended = await endSessions(req, userId, [session.sid])
  res.json({ id: handle, ended: ended === 1 })
}
