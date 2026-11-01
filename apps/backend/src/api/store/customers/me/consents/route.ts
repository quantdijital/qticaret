import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { askToConfirmConsent } from "../../../../../workflows/messaging/consent-confirmation"
import { MESSAGING_MODULE } from "../../../../../modules/messaging"
import type MessagingModuleService from "../../../../../modules/messaging/service"
import {
  customerAddresses,
  customerConsents,
  storefrontEvidence,
} from "../../../../../workflows/messaging/consents"
import type { StorePostConsentType } from "./validators"
import { clientIp } from "../../../../http/client-ip"

/** GET /store/customers/me/consents (adr/0038 §2): the customer's own answers, without addresses. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ consents: await customerConsents(req.scope, req.auth_context.actor_id) })
}

/**
 * POST /store/customers/me/consents: the customer gives or withdraws
 * consent for campaign messages on a channel, kept with the text's version
 * and a keyed hash of the IP; İYS hears of it (F10 M11). The e-mail is the
 * login its owner confirmed, so it is recorded at once. The phone was only
 * typed: giving consent for it, or withdrawing one not this customer's own,
 * waits for the number's owner to confirm by SMS (double opt-in, security
 * review 2026-10-29), and the answer says so with `pending`.
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
  const messaging = req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const evidence = storefrontEvidence(clientIp(req) ?? "", textVersion)
  if (
    channel === "email" ||
    (status === "revoked" && (await ownConsent(req, customerId, address)))
  ) {
    await messaging.recordConsent({
      channel,
      address,
      status,
      source: "account",
      customer_id: customerId,
      evidence,
    })
    res.json({ consents: await customerConsents(req.scope, customerId), pending: null })
    return
  }
  await askToConfirmConsent(req.scope, {
    channel,
    address,
    status,
    source: "account",
    customer_id: customerId,
    evidence,
  })
  res
    .status(202)
    .json({ consents: await customerConsents(req.scope, customerId), pending: channel })
}

/** Whether the phone's consent on record is this customer's own, which they may withdraw at once. */
async function ownConsent(
  req: AuthenticatedMedusaRequest,
  customerId: string,
  phone: string
): Promise<boolean> {
  const messaging = req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const recipient = messaging.recipientOf("sms", phone)
  if (!recipient) {
    return false
  }
  const [row] = await messaging.listMessageConsents(
    { channel: "sms", recipient_hash: recipient.hash },
    { take: 1, select: ["customer_id"] }
  )
  return row?.customer_id === customerId
}
