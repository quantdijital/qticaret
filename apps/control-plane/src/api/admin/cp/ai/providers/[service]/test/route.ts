import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { checkProviderKey } from "../../../../../../../lib/ai-gateway/check"
import { keyedServices } from "../../../../../../../lib/ai-gateway/keys"
import { noteAuditChanges } from "../../../../../../http/audit"
import { serviceParam } from "../../../params"

/**
 * POST /admin/cp/ai/providers/:service/test (owner; "Bağlantıyı dene",
 * adr/0085 §2): the platform's key for the service tried on its cheapest
 * call that generates nothing. Writes nothing but the audit row (the
 * service and the verdict); no credit moves. The answer is the verdict
 * alone, `{ ok }` or `{ ok: false, reason }`: nothing of the provider's.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = serviceParam(req)
  if (!keyedServices().includes(service)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.ai_service_unknown")
  }
  const check = await checkProviderKey(req.scope, service)
  noteAuditChanges(req, { check: { result: check.ok ? "ok" : check.reason } })
  res.setHeader("Cache-Control", "no-store")
  res.json(check)
}
