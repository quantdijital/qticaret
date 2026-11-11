import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  removeNoteWorkflow,
  saveNoteWorkflow,
} from "../../../../../../../workflows/tenants/tenant-notes"
import { noteAuditChanges } from "../../../../../../http/audit"
import { noteActor, paramOf, tenantParam } from "../../../params"
import type { PostNoteUpdateType } from "../../../validators"

/**
 * POST /admin/cp/tenants/:id/notes/:note_id (owner, operator): a note's
 * words or pin changed, by its author or an owner (`cp.note_not_yours`).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostNoteUpdateType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await saveNoteWorkflow(req.scope).run({
    input: {
      tenant_id: tenant.id,
      note_id: paramOf(req, "note_id"),
      ...req.validatedBody,
      actor: await noteActor(req),
    },
  })
  noteAuditChanges(req, { note: { id: result.id } })
  res.json({ note: { id: result.id } })
}

/** DELETE /admin/cp/tenants/:id/notes/:note_id (owner, operator): by its author or an owner. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await removeNoteWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, note_id: paramOf(req, "note_id"), actor: await noteActor(req) },
  })
  noteAuditChanges(req, { note: { id: result.id, removed: true } })
  res.json({ id: result.id, deleted: true })
}
