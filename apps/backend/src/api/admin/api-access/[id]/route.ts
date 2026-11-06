import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteScopedApiKeyWorkflow } from "../../../../workflows/api-access/delete-api-key"
import { auditContext } from "../../../http/audit/context"

/**
 * DELETE /admin/api-access/:id (F11.6): a revoked key removed from the
 * list with its scopes; an active one is refused (revoke it first). What
 * the key did stays in the audit log.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const { request_id, ip, user_agent } = auditContext(req)
  await deleteScopedApiKeyWorkflow(req.scope).run({
    input: { id, actor_id: req.auth_context.actor_id, request_id, ip, user_agent },
  })
  res.json({ id, deleted: true })
}
