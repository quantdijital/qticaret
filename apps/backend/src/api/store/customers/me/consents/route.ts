import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { MESSAGING_MODULE } from "../../../../../modules/messaging"
import type MessagingModuleService from "../../../../../modules/messaging/service"
import {
  customerAddresses,
  customerConsents,
  storefrontEvidence,
} from "../../../../../workflows/messaging/consents"
import type { StorePostConsentType } from "./validators"

/** GET /store/customers/me/consents (adr/0038 §2): the customer's own answers, without addresses. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ consents: await customerConsents(req.scope, req.auth_context.actor_id) })
}

/**
 * POST /store/customers/me/consents: the customer gives or withdraws
 * consent for campaign messages on a channel, kept with the text's version
 * and a keyed hash of the IP; İYS hears of it (F10 M11).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostConsentType>,
  res: MedusaResponse
): Promise<void> {
  const customerId = req.auth_context.actor_id
  const { channel, status, text_version: textVersion } = req.validatedBody
  const address = (await customerAddresses(req.scope, customerId))[channel]
  if (!address) {
    throw new ValidationError("messaging.no_address", { field: "channel" })
  }
  await req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE).recordConsent({
    channel,
    address,
    status,
    source: "account",
    customer_id: customerId,
    evidence: storefrontEvidence(req.ip ?? req.socket.remoteAddress ?? "", textVersion),
  })
  res.json({ consents: await customerConsents(req.scope, customerId) })
}
