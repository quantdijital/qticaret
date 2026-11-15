import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PREVIEW_PATH } from "../../../../lib/content/preview-token"
import { ValidationError } from "../../../../lib/errors"
import { orderAccessKey } from "../../../../lib/orders/access-token"
import {
  SESSION_IDLE_MS,
  editorSessionStore,
  openEditorSession,
} from "../../../../lib/storefront/editor-session"
import { brandOf } from "../../../../workflows/messaging/brand"
import { layoutRow } from "../../../../workflows/storefront/layout"
import { currentStaffSession } from "../../../http/staff-sessions"

/**
 * POST /admin/storefront-layout/editor-session (adr/0065 §1): the theme
 * editor's live preview, one stable address while the editor is open. The
 * owner and admins only (the staff guard: a write no other role lists),
 * from a signed-in panel session it stays bound to. The draft must have
 * been saved once. The answer is no one's to keep: the address is a token.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const current = currentStaffSession(req)
  if (current?.userId !== req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "storefront_layout.session_needs_sign_in")
  }
  const row = await layoutRow(req.scope)
  if (!row) {
    throw new ValidationError("storefront_layout.nothing_to_preview", { field: "document" })
  }
  const opened = await openEditorSession(editorSessionStore(), orderAccessKey(), current)
  const { storefrontUrl } = await brandOf(req.scope)
  const path = `${PREVIEW_PATH}/${opened.token}`
  res.json({
    id: opened.id,
    url: storefrontUrl ? `${storefrontUrl}${path}` : path,
    path,
    expires_at: opened.expires_at,
    idle_ms: SESSION_IDLE_MS,
  })
}
