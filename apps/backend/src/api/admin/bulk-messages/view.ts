import { countsOf, shownCounts } from "../../../lib/campaigns/types"

interface CampaignRow {
  id: string
  name: string
  channel: string
  audience: unknown
  subject: string | null
  preheader: string | null
  body: unknown
  sms_text: string | null
  utm_campaign: string
  status: string
  paused_reason: string | null
  failure_reason: string | null
  scheduled_at: Date | string | null
  started_at: Date | string | null
  finished_at: Date | string | null
  created_by: string | null
  sent_by: string | null
  counts: unknown
  created_at: Date | string
  updated_at: Date | string
}

/** A campaign in the list: no content, its numbers. */
export const campaignSummary = (campaign: CampaignRow) => {
  return {
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    audience: campaign.audience,
    status: campaign.status,
    paused_reason: campaign.paused_reason,
    scheduled_at: campaign.scheduled_at,
    started_at: campaign.started_at,
    finished_at: campaign.finished_at,
    counts: shownCounts(countsOf(campaign.counts)),
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  }
}

/** A campaign as its editor opens it (adr/0050 §10); nothing in it names a recipient. */
export const campaignView = (campaign: CampaignRow) => ({
  ...campaignSummary(campaign),
  subject: campaign.subject,
  preheader: campaign.preheader,
  body: campaign.body,
  sms_text: campaign.sms_text,
  utm_campaign: campaign.utm_campaign,
  failure_reason: campaign.failure_reason,
  created_by: campaign.created_by,
  sent_by: campaign.sent_by,
  /** Whether its content may still change; once it is scheduled or sending, a copy may. */
  editable: campaign.status === "draft",
})
