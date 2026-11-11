import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { prepareSigningKeyWorkflow } from "../../../../../../workflows/vault/signing-keys"
import { noteAuditChanges } from "../../../../../http/audit"

/**
 * POST /admin/cp/keys/signing/prepare (owner, step-up): a new signing key
 * pair (adr/0061 §4.5, Ek C8). The first one signs at once (`active`);
 * later ones are `next`: published to the shops, signing only after the
 * switch. The private half is sealed in the vault and never returned.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await prepareSigningKeyWorkflow(req.scope).run()
  noteAuditChanges(req, { kid: { to: result.kid }, status: { to: result.status } })
  res.json({ signing_key: result })
}
