import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ORDER_KINDS } from "../../../../../../lib/legal"
import { LEGAL_MODULE } from "../../../../../../modules/legal"
import type LegalModuleService from "../../../../../../modules/legal/service"
import { cartContract, renderContract } from "../../../../../../workflows/legal/contracts"
import { kindOf } from "../../../../../admin/legal-documents/kind"
import type { StoreGetCartContractType } from "../../legal-consents/validators"

/**
 * GET /store/carts/:id/legal/:kind (F13.2): a contract made with an order,
 * filled with the cart as the shopper is about to buy it, for the checkout
 * to show before it is accepted. The version comes back to be sent with
 * the consent.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetCartContractType>,
  res: MedusaResponse
): Promise<void> {
  const kind = kindOf(req)
  if (!ORDER_KINDS.has(kind)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.unknown")
  }
  const cart = await cartContract(
    req.scope,
    req.params["id"] ?? "",
    req.validatedQuery.payment ?? null
  )
  if (
    !cart ||
    cart.completed ||
    !req.publishable_key_context.sales_channel_ids.includes(cart.sales_channel_id ?? "")
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  const published = await req.scope
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .versionOf(kind, "published")
  if (!published) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.not_published")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({
    document: {
      kind,
      version: published.version,
      title: published.title,
      html: await renderContract(req.scope, published.body, cart.facts),
    },
  })
}
