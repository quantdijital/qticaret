import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { switchSigningKeyWorkflow } from "../../../../../../workflows/vault/signing-keys"
import { noteAuditChanges } from "../../../../../http/audit"

/**
 * POST /admin/cp/keys/signing/switch (owner, step-up): new documents are
 * signed with the `next` key; the old one stays published as `previous`,
 * so what it signed keeps verifying while the shops move over (adr/0061
 * §4.5). Refused without a `next` key or while a `previous` one waits.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await switchSigningKeyWorkflow(req.scope).run()
  noteAuditChanges(req, { active: { from: result.from, to: result.to } })
  res.json({ active: result.to, previous: result.from })
}
