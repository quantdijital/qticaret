import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { CampaignVars } from "../../lib/messaging/templates"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import type { Loaded } from "../messaging/loaders/types"
import { personalise, prepareCampaign } from "./prepare"

/** A customer's address on the channel and first name, as they are now. */
async function customerTarget(
  container: Pick<MedusaContainer, "resolve">,
  customerId: string,
  channel: "email" | "sms"
) {
  const [customer] = await container
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: customerId }, { select: ["email", "phone", "first_name"], take: 1 })
  return {
    address: (channel === "email" ? customer?.email : customer?.phone) ?? null,
    firstName: customer?.first_name ?? null,
  }
}

/** A subscriber's address, decrypted in memory for this send only (adr/0050 §3). */
async function subscriberTarget(container: Pick<MedusaContainer, "resolve">, consentId: string) {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const [consent] = await messaging.listMessageConsents(
    { id: consentId },
    { select: ["recipient_encrypted"], take: 1 }
  )
  return { address: consent ? messaging.iysAddressOf(consent) : null, firstName: null }
}

/**
 * `marketing.campaign` from its ids (adr/0050 §4): the record the message
 * went to (a customer or a newsletter consent) and, in `extra`, its
 * campaign. Null for a campaign or a recipient gone (cancelled, erased).
 * Whether it may go is deliver()'s, as for every commercial message.
 */
export async function loadCampaignMessage(
  container: Pick<MedusaContainer, "resolve">,
  sourceId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<CampaignVars> | null> {
  const campaignId = extra["campaign_id"]
  if (!campaignId) {
    return null
  }
  const service = container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
  const [[campaign], [recipient]] = await Promise.all([
    service.listBulkMessages(
      { id: campaignId, status: ["sending", "paused", "sent"] },
      { take: 1 }
    ),
    service.listBulkMessageRecipients(
      { campaign_id: campaignId, source_id: sourceId },
      { take: 1 }
    ),
  ])
  if (!campaign || !recipient) {
    return null
  }
  const { address, firstName } =
    recipient.source === "customer"
      ? await customerTarget(container, sourceId, campaign.channel)
      : await subscriberTarget(container, sourceId)
  const prepared = await prepareCampaign(container as MedusaContainer, campaign)
  return {
    vars: personalise(prepared, firstName),
    recipients: { [campaign.channel]: address },
    receiverId: recipient.customer_id,
    resourceType: recipient.source === "customer" ? "customer" : "message_consent",
  }
}
