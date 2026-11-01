import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MESSAGING_MODULE } from "../../../../../modules/messaging"
import type MessagingModuleService from "../../../../../modules/messaging/service"
import { storefrontEvidence } from "../../../../../workflows/messaging/consents"
import type { StorePostCheckoutConsentType } from "../../../customers/me/consents/validators"
import { clientIp } from "../../../../http/client-ip"

/**
 * POST /store/carts/:id/consents (adr/0038 §2): the consent boxes the
 * shopper ticked at checkout, kept against the cart; once it becomes an
 * order they are recorded for the order's e-mail and phone. Sent again,
 * the last answer counts.
 */
export async function POST(
  req: MedusaRequest<StorePostCheckoutConsentType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at"],
    filters: { id: cartId },
  })
  const cart = data[0] as { completed_at: unknown } | undefined
  if (!cart || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  const { email, sms, text_version: textVersion } = req.validatedBody
  const evidence = storefrontEvidence(clientIp(req) ?? "", textVersion)
  const messaging = req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const [existing] = await messaging.listCheckoutConsents({ cart_id: cartId }, { take: 1 })
  const values = {
    email,
    sms,
    text_version: textVersion,
    ip_hash: evidence["ip_hash"] ?? null,
    given_at: new Date(),
  }
  if (existing) {
    await messaging.updateCheckoutConsents({ id: existing.id, ...values })
  } else {
    await messaging.createCheckoutConsents({ cart_id: cartId, ...values })
  }
  res.json({ consents: { email, sms } })
}
