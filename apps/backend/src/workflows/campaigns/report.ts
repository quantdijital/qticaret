import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { countsOf, shownCounts, tallied } from "../../lib/campaigns/types"
import type { CampaignCounts } from "../../lib/campaigns/types"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { TRAFFIC_SOURCES_MODULE } from "../../modules/traffic-sources"
import type TrafficSourcesModuleService from "../../modules/traffic-sources/service"
import { reportedRates } from "./rates"
import { campaignOf } from "./save"

type Container = Pick<MedusaContainer, "resolve">

/** What the report measures after a campaign: its week (adr/0050 §9). */
const AFTER_MS = 7 * 24 * 60 * 60 * 1000
const READ_MAX = 10_000
const ORDER_PAGE = 500

type Campaign = Awaited<ReturnType<typeof campaignOf>>

const windowOf = (campaign: Campaign) => {
  const start = new Date(campaign.started_at ?? 0)
  const end = new Date(new Date(campaign.finished_at ?? Date.now()).getTime() + AFTER_MS)
  return { start, end }
}

/** Its recipients who withdrew consent on the channel within the week after it. */
async function unsubscribedAfter(container: Container, campaign: Campaign): Promise<number> {
  const { start, end } = windowOf(campaign)
  const revoked = await container
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .listMessageConsents(
      { channel: campaign.channel, status: "revoked", changed_at: { $gte: start, $lte: end } },
      { select: ["recipient_hash"], take: READ_MAX }
    )
  if (revoked.length === 0) {
    return 0
  }
  const ours = await container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE).sentAmong(
    campaign.id,
    revoked.map((row) => row.recipient_hash)
  )
  return ours.size
}

interface OrderRow {
  total?: number | string | null
  canceled_at?: string | Date | null
  cart?: { id: string } | null
}

/**
 * What it brought to the storefront within the week (F11.2): carts whose
 * first landing carried its `utm_campaign`, their orders and revenue.
 * Counted by the campaign's code, never by person.
 */
async function trafficOf(container: MedusaContainer, campaign: Campaign) {
  const { start, end } = windowOf(campaign)
  const landings = await container
    .resolve<TrafficSourcesModuleService>(TRAFFIC_SOURCES_MODULE)
    .listTrafficSourceRecords(
      { utm_campaign: campaign.utm_campaign, created_at: { $gte: start, $lte: end } },
      { select: ["cart_id"], take: READ_MAX }
    )
  const carts = new Set(landings.map((row) => row.cart_id))
  let orders = 0
  let revenue = 0
  if (carts.size > 0) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    for (let skip = 0; ; skip += ORDER_PAGE) {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "total", "canceled_at", "cart.id"],
        filters: { created_at: { $gte: start, $lte: end } },
        pagination: { skip, take: ORDER_PAGE, order: { created_at: "ASC" } },
      })
      for (const order of data as OrderRow[]) {
        if (order.cart && carts.has(order.cart.id) && !order.canceled_at) {
          orders += 1
          revenue += Number(order.total ?? 0)
        }
      }
      if (data.length < ORDER_PAGE) {
        break
      }
    }
  }
  return { carts: carts.size, orders, revenue: Math.round(revenue * 100) / 100 }
}

/** The counts with what the reports, the consents and the storefront say now. */
export async function liveCounts(container: Container, campaign: Campaign) {
  const service = container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
  const stored = countsOf(campaign.counts)
  const rows = await service.tally(campaign.id)
  if (rows.length === 0) {
    // Not fixed yet, or its recipients gone after 90 days: the counts kept
    return stored
  }
  const [rates, unsubscribed] = await Promise.all([
    reportedRates(container, campaign),
    unsubscribedAfter(container, campaign),
  ])
  return { ...tallied(stored, rows), ...rates, unsubscribed } satisfies CampaignCounts
}

/** GET /admin/bulk-messages/:id/report (adr/0050 §9): numbers only, no one named. */
export async function campaignReport(container: MedusaContainer, id: string) {
  const campaign = await campaignOf(container.resolve(CAMPAIGNS_MODULE), id)
  const counts = await liveCounts(container, campaign)
  return {
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    status: campaign.status,
    paused_reason: campaign.paused_reason,
    utm_campaign: campaign.utm_campaign,
    started_at: campaign.started_at,
    finished_at: campaign.finished_at,
    counts: shownCounts(counts),
    traffic: campaign.started_at ? await trafficOf(container, campaign) : null,
  }
}
