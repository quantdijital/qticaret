import type { MedusaContainer } from "@medusajs/framework/types"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"

type Container = Pick<MedusaContainer, "resolve">

/** A person's rows in campaigns: by their customer record, or by their e-mails' keyed hashes. */
async function rowsOf(container: Container, customerId: string, addresses: string[]) {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const hashes = addresses.flatMap((address) => messaging.recipientOf("email", address)?.hash ?? [])
  const service = container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
  const rows = await service.listBulkMessageRecipients(
    hashes.length
      ? { $or: [{ customer_id: customerId }, { recipient_hash: hashes }] }
      : { customer_id: customerId },
    { select: ["id", "campaign_id", "status", "sent_at"], take: null }
  )
  return { service, rows }
}

/** For a KVKK copy (adr/0041 §6): which bulk messages went to them, and when. */
export async function campaignMessagesFor(
  container: Container,
  customerId: string,
  addresses: string[]
) {
  const { service, rows } = await rowsOf(container, customerId, addresses)
  if (rows.length === 0) {
    return []
  }
  const campaigns = await service.listBulkMessages(
    { id: [...new Set(rows.map((row) => row.campaign_id))] },
    { select: ["id", "name", "channel"] }
  )
  const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]))
  return rows.map((row) => ({
    kampanya: byId.get(row.campaign_id)?.name ?? null,
    kanal: byId.get(row.campaign_id)?.channel ?? null,
    durum: row.status,
    gönderilme: row.sent_at,
  }))
}

/** For a KVKK erasure (adr/0050 §8): their recipient rows go; the campaigns keep their counts. */
export async function eraseCampaignRecipients(
  container: Container,
  customerId: string,
  addresses: string[]
): Promise<number> {
  const { service, rows } = await rowsOf(container, customerId, addresses)
  if (rows.length > 0) {
    await service.deleteBulkMessageRecipients(rows.map((row) => row.id))
  }
  return rows.length
}
