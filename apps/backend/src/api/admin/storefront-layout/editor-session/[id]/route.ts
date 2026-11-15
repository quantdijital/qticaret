import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  closeEditorSession,
  editorSessionStore,
  renewEditorSession,
} from "../../../../../lib/storefront/editor-session"

const idOf = (req: AuthenticatedMedusaRequest) =>
  (req.params as Record<string, string | undefined>)["id"] ?? ""

/**
 * PUT /admin/storefront-layout/editor-session/:id (adr/0065 §1): the open
 * editor says it is still there; the session's idle time starts again
 * (never past its 12 hours). Only its own staff member's; anyone else's,
 * or one ended, is a 404.
 */
export async function PUT(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const renewed = await renewEditorSession(
    editorSessionStore(),
    idOf(req),
    req.auth_context.actor_id
  )
  if (!renewed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.session_unknown")
  }
  res.json({ id: idOf(req), renewed: true })
}

/** DELETE /admin/storefront-layout/editor-session/:id: the editor closed; its address opens nothing. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const closed = await closeEditorSession(
    editorSessionStore(),
    idOf(req),
    req.auth_context.actor_id
  )
  res.json({ id: idOf(req), deleted: closed })
}
