import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { LEGAL_MODULE } from "../../../../../modules/legal"
import type LegalModuleService from "../../../../../modules/legal/service"
import { recordLegalConsentWorkflow } from "../../../../../workflows/legal/consent"
import type { StorePostLegalConsentsType } from "./validators"
import { clientIp } from "../../../../http/client-ip"

/**
 * POST /store/carts/:id/legal-consents (F13.2, adr/0041 §2): the shopper
 * accepts the distance sales contract and the pre-information form, by
 * the versions the storefront showed. Sent before the payment starts; a
 * version published since is refused (409) and shown again.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostLegalConsentsType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { result } = await recordLegalConsentWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      documents: req.validatedBody.documents,
      ip_encrypted: req.scope
        .resolve<LegalModuleService>(LEGAL_MODULE)
        .sealIp(cartId, clientIp(req)),
    },
  })
  res.json({ consent: result })
}
