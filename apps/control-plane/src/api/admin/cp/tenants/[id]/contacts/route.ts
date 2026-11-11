import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveContactWorkflow } from "../../../../../../workflows/tenants/tenant-contacts"
import { noteAuditChanges } from "../../../../../http/audit"
import { tenantParam } from "../../params"
import type { PostContactType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/contacts (owner, operator): a person at the
 * shop: name, role, e-mail, phone (E.164). The first one of a shop without
 * a primary billing contact becomes it. Recorded by field names only.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostContactType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { phone, ...fields } = req.validatedBody
  const { result } = await saveContactWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, contact_id: null, fields: { ...fields, phone: phone ?? null } },
  })
  noteAuditChanges(req, { contact: { id: result.id } })
  res.json({ contact: { id: result.id } })
}
