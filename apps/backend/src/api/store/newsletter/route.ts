import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storefrontEvidence } from "../../../workflows/messaging/consents"
import { askNewsletterConsentLater } from "../../../workflows/messaging/newsletter"
import { clientIp } from "../../http/client-ip"
import type { StorePostNewsletterType } from "./validators"

/**
 * POST /store/newsletter (F18, adr/0038 §2): a visitor asks for the shop's
 * campaign e-mails from the storefront's newsletter box. Nothing is
 * recorded, nor told to İYS, until the address's owner opens the link sent
 * to it (double opt-in). The answer is the same, and as quick, for every
 * address: the confirmation is decided and sent off the request's path.
 */
export function POST(
  req: AuthenticatedMedusaRequest<StorePostNewsletterType>,
  res: MedusaResponse
): void {
  const { email, text_version: textVersion } = req.validatedBody
  // A guest has no auth context at all
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  askNewsletterConsentLater(req.scope, {
    email,
    customer_id: auth?.actor_type === "customer" && auth.actor_id ? auth.actor_id : null,
    evidence: storefrontEvidence(clientIp(req) ?? "", textVersion),
  })
  res.status(202).json({ status: "pending" })
}
