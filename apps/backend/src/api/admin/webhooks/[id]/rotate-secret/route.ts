import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_WEBHOOKS_MODULE } from "../../../../../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../../../../modules/tenant-webhooks/service"
import { ownedBy } from "../../view"

/**
 * POST /admin/webhooks/:id/rotate-secret (F11.7, the F15 audit): a new
 * signing secret, returned here once; the old one signs nothing more,
 * queued deliveries included. For a secret seen where it should not be.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const hooks = req.scope.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
  // A key's own only: another's reads as unknown
  const [row] = await hooks.listWebhookSubscriptions(
    { id, ...ownedBy(req) },
    { select: ["id"], take: 1 }
  )
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "webhook.unknown")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ id: row.id, secret: await hooks.rotateSecret(row.id) })
}
