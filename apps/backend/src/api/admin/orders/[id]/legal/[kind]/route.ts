import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { LEGAL_MODULE } from "../../../../../../modules/legal"
import type LegalModuleService from "../../../../../../modules/legal/service"
import { kindOf } from "../../../../legal-documents/kind"

/**
 * GET /admin/orders/:id/legal/:kind (F13.2): the contract as it was made
 * with the order, and whether it still matches the hash it was kept with.
 * A recorded read: it names the buyer and their address.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const copy = await req.scope
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .readOrderCopy(req.params["id"] ?? "", kindOf(req))
  if (!copy) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.copy_unknown")
  }
  res.json({ document: copy })
}
