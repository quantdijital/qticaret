import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../../../../lib/logging"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { editorSessionOf, editorSessionStore } from "../../../../../lib/storefront/editor-session"
import { STAFF_ROLES_MODULE } from "../../../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../../../modules/staff-roles/service"
import { layoutRow } from "../../../../../workflows/storefront/layout"
import { sessionHolds } from "../../../../http/staff-sessions"
import { draftLayout } from "../../draft"

/** The roles that write the design (adr/0049 §5, adr/0040); the session dies with the role. */
const DESIGNERS = new Set(["owner", "admin"])

const unknown = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.session_unknown")

/**
 * GET /store/storefront-layout/session/:token (adr/0065 §1): the draft as
 * last saved, for the theme editor's live preview, with its `edition` (the
 * moment it was saved). The token opens only while its session is kept,
 * the panel session it was opened from is still signed in as the same
 * staff member, and they still write the design: a sign-out, a password
 * change, a role taken away or the editor closed ends it. Anything else,
 * Redis out of reach included, is a 404 (the panel falls back to signed
 * links). Never kept by anyone.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store")
  let session
  try {
    session = await editorSessionOf(
      editorSessionStore(),
      orderAccessKey(),
      req.params["token"] ?? ""
    )
  } catch (error) {
    // The store out of reach: no session opens; the token itself is never logged
    logger.warn({ event: "editor_session.unreadable", err: errorSummary(error) })
    throw unknown()
  }
  if (!session || !(await sessionHolds(req, session.sid, session.user_id))) {
    throw unknown()
  }
  const role = await req.scope
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .roleOf(session.user_id)
  if (!role || !DESIGNERS.has(role)) {
    throw unknown()
  }
  const row = await layoutRow(req.scope)
  const updated = (row as unknown as { updated_at?: Date } | null)?.updated_at
  if (!row || !updated) {
    throw unknown()
  }
  res.json({ layout: await draftLayout(req, row), edition: new Date(updated).toISOString() })
}
