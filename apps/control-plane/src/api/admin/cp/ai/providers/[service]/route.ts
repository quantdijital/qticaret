import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteProviderKey, writeProviderKey } from "../../../../../../lib/ai-gateway/keys"
import { noteAuditChanges } from "../../../../../http/audit"
import { actorOf, paramOf } from "../../../tenants/params"
import type { PostProviderKeyType } from "../../validators"

/**
 * POST /admin/cp/ai/providers/:service (owner, step-up; adr/0085 §2): a
 * new version of the service's key sealed in the vault. Written only: the
 * answer and the audit row carry its version and time, never the key.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostProviderKeyType>,
  res: MedusaResponse
): Promise<void> {
  const service = paramOf(req, "service")
  const meta = await writeProviderKey(req.scope, service, req.validatedBody.api_key)
  noteAuditChanges(req, { key: { to: { version: meta.version } } })
  res.setHeader("Cache-Control", "no-store")
  res.json({ provider: { service, has_key: true, ...meta } })
}

/**
 * DELETE /admin/cp/ai/providers/:service (owner, step-up): every routing
 * to the service taken out, then its key destroyed (every version).
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = paramOf(req, "service")
  const done = await deleteProviderKey(req.scope, service, actorOf(req))
  noteAuditChanges(req, { key: { deleted: done.deleted }, unrouted: done.unrouted })
  res.json({ provider: { service, has_key: false }, ...done })
}
