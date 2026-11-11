import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { retireSigningKeyWorkflow } from "../../../../../../workflows/vault/signing-keys"
import { noteAuditChanges } from "../../../../../http/audit"

/**
 * POST /admin/cp/keys/signing/retire (owner, step-up): the `previous` key
 * leaves the published set and its private half is destroyed (adr/0061
 * §4.5). Irreversible: documents it signed stop verifying once the shops
 * drop it from `CONTROL_PLANE_PUBLIC_KEYS`.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await retireSigningKeyWorkflow(req.scope).run()
  noteAuditChanges(req, { retired: { to: result.kid } })
  res.json({ retired: result.kid })
}
