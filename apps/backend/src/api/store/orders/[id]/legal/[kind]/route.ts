import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { LEGAL_MODULE } from "../../../../../../modules/legal"
import type LegalModuleService from "../../../../../../modules/legal/service"
import { orderAccessOf } from "../../../../../http/order-access"
import { kindOf } from "../../../../../admin/legal-documents/kind"

/**
 * GET /store/orders/:id/legal/:kind (F13.2): the contract as it was made
 * with the order, for its own customer or the holder of its key (the
 * order's e-mail links to the order's page, which shows it).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const access = orderAccessOf(req)
  const copy = await req.scope
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .readOrderCopy(access.order_id, kindOf(req))
  if (!copy) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.copy_unknown")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({
    document: {
      kind: copy.kind,
      version: copy.version,
      title: copy.title,
      html: copy.html,
      created_at: copy.created_at,
    },
  })
}
