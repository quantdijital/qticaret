import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { issueSupportGrant, operatorName } from "../../../../../../lib/tenants/support-grant"
import { saveNoteWorkflow } from "../../../../../../workflows/tenants/tenant-notes"
import { cpStaff } from "../../../../../http/caller"
import { noteAuditChanges } from "../../../../../http/audit"
import { actorOf, tenantParam } from "../../params"
import type { PostSupportGrantType } from "./validators"

/**
 * POST /admin/cp/tenants/:id/support-grants (owner, operator, step-up every
 * time; adr/0061 Ek "Destek erişimi" 2026-11-28, Karar 7): a signed,
 * single-use grant into the shop's panel for at most an hour, answered
 * once as the link to open. The reason stays as a note on the shop (who
 * wrote it, when); the audit row keeps the grant's id, the minutes and the
 * reason's length, never the grant or its signature.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostSupportGrantType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const userId = actorOf(req)
  const role = await cpStaff(req).roleOf(userId)
  if (role !== "owner" && role !== "operator") {
    // The route table lets only these through; a role changed meanwhile is refused here
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.forbidden")
  }
  const { reason, minutes } = req.validatedBody
  const issued = await issueSupportGrant(req.scope, {
    tenant,
    operator: { id: userId, name: await operatorName(req.scope, userId), role },
    reason,
    minutes,
  })
  const { result: note } = await saveNoteWorkflow(req.scope).run({
    input: {
      tenant_id: tenant.id,
      note_id: null,
      body: `Destek erişimi (${String(minutes)} dk): ${reason}`,
      pinned: false,
      actor: { id: userId, owner: role === "owner" },
    },
  })
  noteAuditChanges(req, {
    support_grant: { id: issued.grant_id, minutes, reason_length: reason.length, note: note.id },
  })
  res.setHeader("Cache-Control", "no-store")
  res.json(issued)
}
