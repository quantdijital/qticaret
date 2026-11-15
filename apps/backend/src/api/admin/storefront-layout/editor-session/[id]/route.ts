import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  closeEditorSession,
  editorSessionStore,
  renewEditorSession,
} from "../../../../../lib/storefront/editor-session"
import { currentStaffSession } from "../../../../http/staff-sessions"

const idOf = (req: AuthenticatedMedusaRequest) =>
  (req.params as Record<string, string | undefined>)["id"] ?? ""

const unknown = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.session_unknown")

/**
 * PUT /admin/storefront-layout/editor-session/:id (adr/0065 §1): the open
 * editor says it is still there; the session's idle time starts again
 * (never past its 12 hours). Only its own staff member's, asked from the
 * panel session it was opened from (that one still signed in: it is the
 * one asking); anyone else's, another panel session's, a bearer request's
 * or one ended is a 404.
 */
export async function PUT(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const current = currentStaffSession(req)
  if (current?.userId !== req.auth_context.actor_id) {
    throw unknown()
  }
  const renewed = await renewEditorSession(editorSessionStore(), idOf(req), current)
  if (!renewed) {
    throw unknown()
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
