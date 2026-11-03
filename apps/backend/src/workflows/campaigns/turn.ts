import { setTimeout as sleep } from "node:timers/promises"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type { PauseReason } from "../../modules/campaigns/models/campaign"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { deliver } from "../messaging/deliver"
import type { SendOutcome } from "../messaging/deliver"
import { quotaLeft } from "./quota"
import { personalise, prepareCampaign } from "./prepare"

type Campaign = Awaited<ReturnType<CampaignsModuleService["listBulkMessages"]>>[number]
type Recipient = Awaited<ReturnType<CampaignsModuleService["listBulkMessageRecipients"]>>[number]

/** A turn stops sending past this, inside the job's minute: the next turn goes on. */
const TURN_BUDGET_MS = 55_000
/** Sends between two looks at the campaign's status. */
const STATUS_EVERY = 10

interface Target {
  address: string | null
  firstName: string | null
}

/**
 * Where each recipient's message goes, read now: the customer's address
 * and first name, or a subscriber's address decrypted in memory for this
 * send only (adr/0050 §3). Nothing of it is stored or logged.
 */
async function targetsOf(
  container: MedusaContainer,
  channel: "email" | "sms",
  rows: readonly Recipient[]
): Promise<Map<string, Target>> {
  const customerIds = rows.filter((row) => row.source === "customer").map((row) => row.source_id)
  const consentIds = rows.filter((row) => row.source === "consent").map((row) => row.source_id)
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const [customers, consents] = await Promise.all([
    customerIds.length
      ? container
          .resolve(Modules.CUSTOMER)
          .listCustomers(
            { id: customerIds },
            { select: ["id", "email", "phone", "first_name"], take: customerIds.length }
          )
      : [],
    consentIds.length
      ? messaging.listMessageConsents(
          { id: consentIds, channel },
          { select: ["id", "recipient_encrypted"], take: consentIds.length }
        )
      : [],
  ])
  const byCustomer = new Map(customers.map((customer) => [customer.id, customer]))
  const byConsent = new Map(consents.map((consent) => [consent.id, consent]))
  const targets = new Map<string, Target>()
  for (const row of rows) {
    if (row.source === "customer") {
      const customer = byCustomer.get(row.source_id)
      targets.set(row.id, {
        address: (channel === "email" ? customer?.email : customer?.phone) ?? null,
        firstName: customer?.first_name ?? null,
      })
    } else {
      const consent = byConsent.get(row.source_id)
      targets.set(row.id, {
        address: consent ? messaging.iysAddressOf(consent) : null,
        firstName: null,
      })
    }
  }
  return targets
}

const SKIPPED: ReadonlySet<SendOutcome> = new Set(["no_consent", "suppressed", "invalid_recipient"])

/**
 * Sends to the campaign's next recipients, each through deliver() under
 * the key `marketing.campaign:<channel>:<record>:<campaign>`: a turn cut
 * short and run again sends no one a second message. Returns what it sent
 * and why it stopped, if it did: the day's quota spent, the channel off.
 */
export async function sendTurn(
  container: MedusaContainer,
  campaign: Campaign,
  options: { batch: number; spacing: number; now: Date }
): Promise<{ sent: number; stop: PauseReason | null }> {
  const service = container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
  const rows = await service.listBulkMessageRecipients(
    { campaign_id: campaign.id, status: "pending" },
    { take: options.batch, order: { id: "ASC" } }
  )
  if (rows.length === 0) {
    return { sent: 0, stop: null }
  }
  const prepared = await prepareCampaign(container, campaign)
  const targets = await targetsOf(container, campaign.channel, rows)
  const started = Date.now()
  let sent = 0
  for (const [index, row] of rows.entries()) {
    if (index > 0) {
      await sleep(options.spacing)
      if (Date.now() - started > TURN_BUDGET_MS) {
        break
      }
    }
    // Staff may pause or cancel it while a turn runs: it stops within a few sends
    if (index > 0 && index % STATUS_EVERY === 0) {
      const [now] = await service.listBulkMessages(
        { id: campaign.id },
        { select: ["status"], take: 1 }
      )
      if (now?.status !== "sending") {
        break
      }
    }
    const target = targets.get(row.id)
    const outcome: SendOutcome = target?.address
      ? ((
          await deliver(container, {
            template: "marketing.campaign",
            resource: {
              type: row.source === "customer" ? "customer" : "message_consent",
              id: row.source_id,
            },
            recipients: { [campaign.channel]: target.address },
            receiverId: row.customer_id,
            vars: personalise(prepared, target.firstName),
            key: campaign.id,
          })
        )[campaign.channel] ?? "invalid_recipient")
      : "invalid_recipient"
    if (outcome === "channel_off") {
      return { sent, stop: "channel_off" }
    }
    if (outcome === "over_quota") {
      // The shop's day is spent: wait for the next. Else only this number's own limit was
      if ((await quotaLeft(container, campaign.channel, options.now)).left <= 0) {
        return { sent, stop: "quota" }
      }
      await service.updateBulkMessageRecipients({ id: row.id, status: "skipped", reason: outcome })
      continue
    }
    if (outcome === "sent" || outcome === "duplicate") {
      sent += 1
      await service.updateBulkMessageRecipients({ id: row.id, status: "sent", sent_at: new Date() })
    } else {
      await service.updateBulkMessageRecipients({
        id: row.id,
        status: SKIPPED.has(outcome) ? "skipped" : "failed",
        reason: outcome,
      })
    }
  }
  return { sent, stop: null }
}
