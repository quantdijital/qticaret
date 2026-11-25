import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteProviderKey, writeProviderKey } from "../../../../../../lib/ai-gateway/keys"
import type { ProviderKeyDeletion } from "../../../../../../lib/ai-gateway/keys"
import { noteAuditChanges } from "../../../../../http/audit"
import { notingPartlyDone } from "../../../../../http/partly-done"
import { actorOf } from "../../../tenants/params"
import { serviceParam } from "../../params"
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
  const service = serviceParam(req)
  const meta = await writeProviderKey(req.scope, service, req.validatedBody.api_key)
  noteAuditChanges(req, { key: { to: { version: meta.version } } })
  res.setHeader("Cache-Control", "no-store")
  res.json({ provider: { service, has_key: true, ...meta } })
}

/**
 * DELETE /admin/cp/ai/providers/:service (owner, step-up): every routing
 * to the service taken out, then its key destroyed (every version), then
 * its routing taken out once more (a save racing the delete, P6b). A
 * step failing after the key is retired still audits the delete, marked
 * `unfinished`, and answers the error.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = serviceParam(req)
  const changesOf = (done: ProviderKeyDeletion) => ({
    key: { deleted: done.deleted },
    unrouted: done.unrouted,
  })
  const done = await notingPartlyDone(
    req,
    () => deleteProviderKey(req.scope, service, actorOf(req)),
    changesOf
  )
  noteAuditChanges(req, changesOf(done))
  res.json({ provider: { service, has_key: false }, ...done })
}
