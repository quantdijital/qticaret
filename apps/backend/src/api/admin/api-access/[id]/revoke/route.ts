import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { revokeApiKeysWorkflow } from "@medusajs/medusa/core-flows"

/**
 * POST /admin/api-access/:id/revoke (F11.6): the key is refused from its
 * next request (Medusa checks it on every call, no cache; KK4).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const [key] = await req.scope
    .resolve(Modules.API_KEY)
    .listApiKeys({ id, type: "secret" }, { take: 1 })
  if (!key) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "api_key.unknown")
  }
  if (!key.revoked_at) {
    await revokeApiKeysWorkflow(req.scope).run({
      input: { selector: { id }, revoke: { revoked_by: req.auth_context.actor_id } },
    })
  }
  res.json({ revoked: true })
}
