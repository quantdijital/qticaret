import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MESSAGING_MODULE } from "../../../modules/messaging"
import type MessagingModuleService from "../../../modules/messaging/service"
import { askToConfirmConsent } from "../../../workflows/messaging/consent-confirmation"
import { storefrontEvidence } from "../../../workflows/messaging/consents"
import { clientIp } from "../../http/client-ip"
import type { StorePostNewsletterType } from "./validators"

/**
 * POST /store/newsletter (F18, adr/0038 §2): a visitor asks for the shop's
 * campaign e-mails from the storefront's newsletter box. Nothing is
 * recorded, nor told to İYS, until the address's owner opens the link sent
 * to it (double opt-in); an address that already said yes is sent nothing.
 * The answer is the same either way.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostNewsletterType>,
  res: MedusaResponse
): Promise<void> {
  const { email, text_version: textVersion } = req.validatedBody
  const messaging = req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE)
  if ((await messaging.consentOf("email", email)) !== "granted") {
    // A guest has no auth context at all
    const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
    await askToConfirmConsent(req.scope, {
      channel: "email",
      address: email,
      status: "granted",
      source: "newsletter",
      customer_id: auth?.actor_type === "customer" && auth.actor_id ? auth.actor_id : null,
      evidence: storefrontEvidence(clientIp(req) ?? "", textVersion),
    })
  }
  res.status(202).json({ status: "pending" })
}
