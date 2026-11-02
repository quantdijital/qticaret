import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import type { ConsentEvidence } from "../../modules/messaging/types"
import { askToConfirmConsent } from "./consent-confirmation"

/** One confirmation e-mail per address in this long, however many ask (security review 2026-11-02). */
const QUIET_MS = 24 * 60 * 60 * 1000

export interface NewsletterAsk {
  email: string
  /** The signed-in customer who asked, if any. */
  customer_id: string | null
  evidence: ConsentEvidence
}

/**
 * The storefront's newsletter box (adr/0038 §2), off the request's path so
 * its answer takes the same time for every address: nothing goes to an
 * address that already said yes, nor to one asked in the last day and not
 * answering yet (no flooding a stranger's inbox). The consent is tied to
 * the account only when the address is the account's own.
 */
export async function askNewsletterConsent(
  container: Pick<MedusaContainer, "resolve">,
  ask: NewsletterAsk
): Promise<void> {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  if ((await messaging.consentOf("email", ask.email)) === "granted") {
    return
  }
  const recipient = messaging.recipientOf("email", ask.email)
  if (!recipient) {
    return
  }
  const [pending] = await messaging.listConsentRequests(
    {
      recipient_hash: recipient.hash,
      source: "newsletter",
      confirmed_at: null,
      created_at: { $gt: new Date(Date.now() - QUIET_MS) },
    },
    { select: ["id"], take: 1 }
  )
  if (pending) {
    return
  }
  let customerId: string | null = null
  if (ask.customer_id) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "customer",
      fields: ["email"],
      filters: { id: ask.customer_id },
    })
    const own = (data[0] as { email?: string | null } | undefined)?.email
    customerId = own?.trim().toLowerCase() === ask.email ? ask.customer_id : null
  }
  await askToConfirmConsent(container, {
    channel: "email",
    address: ask.email,
    status: "granted",
    source: "newsletter",
    customer_id: customerId,
    evidence: ask.evidence,
  })
}

/** The same, never failing the request that asked: a failure is logged. */
export function askNewsletterConsentLater(
  container: Pick<MedusaContainer, "resolve">,
  ask: NewsletterAsk
): void {
  askNewsletterConsent(container, ask).catch((error: unknown) => {
    logger.warn({ event: "messaging.newsletter_failed", err: errorSummary(error) })
  })
}
