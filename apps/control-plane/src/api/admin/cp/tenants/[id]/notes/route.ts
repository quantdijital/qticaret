import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveNoteWorkflow } from "../../../../../../workflows/tenants/tenant-notes"
import { noteAuditChanges } from "../../../../../http/audit"
import { noteActor, tenantParam } from "../../params"
import type { PostNoteType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/notes (owner, operator): a staff note on the
 * shop, plain text up to 2000 characters, pinned or not. Recorded without
 * its words.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostNoteType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await saveNoteWorkflow(req.scope).run({
    input: {
      tenant_id: tenant.id,
      note_id: null,
      body: req.validatedBody.body,
      pinned: req.validatedBody.pinned ?? false,
      actor: await noteActor(req),
    },
  })
  noteAuditChanges(req, { note: { id: result.id } })
  res.json({ note: { id: result.id } })
}
