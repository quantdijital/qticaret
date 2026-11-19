import type { MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { layoutPreview } from "../../../lib/content/preview-token"
import { errorSummary, logger } from "../../../lib/logging"
import { orderAccessKey } from "../../../lib/orders/access-token"
import { editorSessionOf, editorSessionStore } from "../../../lib/storefront/editor-session"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../modules/staff-roles/service"
import { layoutRow } from "../../../workflows/storefront/layout"
import { sessionHolds } from "../../http/staff-sessions"

type Row = NonNullable<Awaited<ReturnType<typeof layoutRow>>>

/** The roles that write the design (adr/0049 §5, adr/0040); the session dies with the role. */
const DESIGNERS = new Set(["owner", "admin"])

const rowSaved = (row: Row | null): Date | undefined =>
  (row as unknown as { updated_at?: Date } | null)?.updated_at

/**
 * The draft a signed design link opens (adr/0049): made for the draft as
 * it is saved now. Anything else is a 404, as if there were no such page.
 */
export async function previewRow(req: MedusaStoreRequest): Promise<Row> {
  const parts = layoutPreview.parts(req.params["token"] ?? "")
  const row = parts ? await layoutRow(req.scope) : null
  const updated = rowSaved(row)
  if (!parts || row?.id !== parts.entryId || !updated) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.preview_unknown")
  }
  if (!layoutPreview.opens(orderAccessKey(), parts, updated)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.preview_unknown")
  }
  return row
}

const sessionUnknown = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.session_unknown")

/**
 * The draft the theme editor's live session reads (adr/0065 §1), with the
 * moment it was saved: the token opens only while its session is kept,
 * the panel session it was opened from is still signed in as the same
 * staff member, and they still write the design. Anything else, Redis
 * out of reach included, is a 404 (the panel falls back to signed links).
 */
export async function sessionRow(req: MedusaStoreRequest): Promise<{ row: Row; edition: string }> {
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
    throw sessionUnknown()
  }
  if (!session || !(await sessionHolds(req, session.sid, session.user_id))) {
    throw sessionUnknown()
  }
  // A plain read: `roleOf` may make a first user owner, which no unsigned request may set off
  const roles = await req.scope
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .rolesOf([session.user_id])
  const role = roles.get(session.user_id)
  if (!role || !DESIGNERS.has(role)) {
    throw sessionUnknown()
  }
  const row = await layoutRow(req.scope)
  const updated = rowSaved(row)
  if (!row || !updated) {
    throw sessionUnknown()
  }
  return { row, edition: new Date(updated).toISOString() }
}
