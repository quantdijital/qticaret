import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import type { MessageChannel } from "../../../../../lib/messaging/recipients"
import { provenCustomer } from "../../../../../workflows/account/proven-customer"
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

/** The same confirmation is sent again only after this long (as "siparişimi bul" does). */
const CONSENT_RESEND_MS = 10 * 60 * 1000

/**
 * GET /store/customers/me/consents (adr/0038 §2): the customer's own
 * answers, without addresses. The e-mail's only once the customer has
 * proven the address is theirs: until then it is its owner's answer.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const proven = await provenCustomer(req.scope, customerId)
  res.setHeader("Cache-Control", "no-store")
  res.json({
    consents: await customerConsents(req.scope, customerId, { emailUnproven: !proven }),
  })
}

/**
 * POST /store/customers/me/consents: the customer gives or withdraws
 * consent for campaign messages on a channel, kept with the text's version
 * and a keyed hash of the IP; İYS hears of it (F10 M11). Recorded at once:
 * the e-mail when its owner has proven it is theirs (`provenCustomer`: the
 * login's address confirmed, or a social provider vouching; a session
 * alone is not proof, security review of PR #73), and the withdrawal of a
 * consent on record as this customer's own. Anything else waits for the
 * address's owner to confirm from it (double opt-in, security review
 * 2026-10-29), and the answer says so with `pending`; asked again while
 * that confirmation is on its way, nothing more is sent.
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
  const proven = await provenCustomer(req.scope, customerId)
  const atOnce =
    (channel === "email" && proven) ||
    (status === "revoked" && (await ownConsent(messaging, customerId, channel, address)))
  const consents = () => customerConsents(req.scope, customerId, { emailUnproven: !proven })
  if (atOnce) {
    await messaging.recordConsent({
      channel,
      address,
      status,
      source: "account",
      customer_id: customerId,
      evidence,
    })
    res.json({ consents: await consents(), pending: null })
    return
  }
  const asked = { channel, address, status, customer_id: customerId }
  const since = new Date(Date.now() - CONSENT_RESEND_MS)
  if (!(await messaging.consentRequestPending(asked, since))) {
    await askToConfirmConsent(req.scope, { ...asked, source: "account", evidence })
  }
  res.status(202).json({ consents: await consents(), pending: channel })
}

/** Whether the address's consent on record is this customer's own, which they may withdraw at once. */
async function ownConsent(
  messaging: MessagingModuleService,
  customerId: string,
  channel: MessageChannel,
  address: string
): Promise<boolean> {
  const recipient = messaging.recipientOf(channel, address)
  if (!recipient) {
    return false
  }
  const [row] = await messaging.listMessageConsents(
    { channel, recipient_hash: recipient.hash },
    { take: 1, select: ["customer_id"] }
  )
  return row?.customer_id === customerId
}
