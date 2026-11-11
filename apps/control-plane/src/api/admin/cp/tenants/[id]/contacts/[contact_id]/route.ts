import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  removeContactWorkflow,
  saveContactWorkflow,
} from "../../../../../../../workflows/tenants/tenant-contacts"
import { noteAuditChanges } from "../../../../../../http/audit"
import { paramOf, tenantParam } from "../../../params"
import type { PostContactType } from "../../../validators"

/** POST /admin/cp/tenants/:id/contacts/:contact_id (owner, operator): a contact changed. */
export async function POST(
  req: AuthenticatedMedusaRequest<PostContactType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { phone, ...fields } = req.validatedBody
  const { result } = await saveContactWorkflow(req.scope).run({
    input: {
      tenant_id: tenant.id,
      contact_id: paramOf(req, "contact_id"),
      fields: { ...fields, phone: phone ?? null },
    },
  })
  noteAuditChanges(req, { contact: { id: result.id } })
  res.json({ contact: { id: result.id } })
}

/**
 * DELETE /admin/cp/tenants/:id/contacts/:contact_id (owner, operator): a
 * contact removed for good (KVKK: not kept once not needed); the primary
 * billing mark moves to who is left.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await removeContactWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, contact_id: paramOf(req, "contact_id") },
  })
  noteAuditChanges(req, { contact: { id: result.id, removed: true } })
  res.json({ id: result.id, deleted: true })
}
