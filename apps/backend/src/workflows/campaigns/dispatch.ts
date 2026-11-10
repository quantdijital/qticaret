import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { overLimit, quotaDay, withinSmsHours } from "../../lib/campaigns/pause"
import { countsOf, emptyCounts, tallied } from "../../lib/campaigns/types"
import type { CampaignCounts } from "../../lib/campaigns/types"
import { isValidationError } from "../../lib/errors"
import { shopSmtpAccount } from "../../lib/messaging/email/shop-transport"
import { smtpPace } from "../../lib/messaging/email/smtp-account"
import { logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type { PauseReason } from "../../modules/campaigns/models/campaign"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { MarketingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { resolveAudience } from "./audience"
import { quotaLeft } from "./quota"
import { channelBlocker } from "./lifecycle"
import { reportedRates } from "./rates"
import { sendTurn } from "./turn"
import type { CampaignSource } from "../../lib/campaigns/types"

type Campaign = Awaited<ReturnType<CampaignsModuleService["listBulkMessages"]>>[number]

export interface DispatchInput {
  /** Recipients a turn sends at most (adr/0050 §6: 120). */
  batch?: number
  /** The pause between two sends: 500 ms is two a second, Resend's default limit. */
  spacing_ms?: number
  now?: Date
}

export interface DispatchResult {
  campaign_id: string | null
  sent: number
  status: string | null
}

const serviceOf = (container: MedusaContainer) =>
  container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)

const settingsOf = (container: MedusaContainer) =>
  container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

async function marketingOf(container: MedusaContainer) {
  return (await settingsOf(container).getSection("marketing")) as unknown as MarketingSettings
}

const pause = (
  container: MedusaContainer,
  campaign: Campaign,
  reason: PauseReason,
  now: Date,
  counts?: CampaignCounts
) =>
  serviceOf(container).transition(campaign.id, ["sending"], "paused", {
    paused_reason: reason,
    paused_day: reason === "quota" ? quotaDay(now) : null,
    ...(counts ? { counts } : {}),
  })

/** Tells staff in the bell that complaints or bounces stopped the campaign (adr/0050 §6). */
async function warnStaff(container: MedusaContainer, campaign: Campaign, which: string) {
  const values = { name: campaign.name }
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: "",
    channel: "feed",
    template: "admin-ui",
    trigger_type: "campaigns.paused_complaints",
    resource_id: campaign.id,
    idempotency_key: `campaigns.paused_complaints:${campaign.id}:${String(Date.now())}`,
    data: {
      kind: "campaigns_paused",
      which,
      campaign_id: campaign.id,
      ...notificationText("campaigns.paused_complaints", values),
    },
  })
}

/**
 * Starts what is due and resumes what waited on the clock: a schedule
 * reached, the quota's day turned or its budget raised, the texts' hours
 * open, the channel back. A pause staff made waits for staff.
 */
async function wakeUp(container: MedusaContainer, now: Date) {
  const service = serviceOf(container)
  const due = await service.listBulkMessages(
    { status: "scheduled", scheduled_at: { $lte: now } },
    { select: ["id"], take: 20 }
  )
  for (const campaign of due) {
    await service.transition(campaign.id, ["scheduled"], "sending", { started_at: now })
  }
  const waiting = await service.listBulkMessages(
    { status: "paused", paused_reason: ["quota", "quiet_hours", "channel_off"] },
    { take: 20 }
  )
  const marketing = await marketingOf(container)
  for (const campaign of waiting) {
    const ready =
      campaign.paused_reason === "quota"
        ? campaign.paused_day !== quotaDay(now) ||
          (await quotaLeft(container, campaign.channel, now)).left > 0
        : campaign.paused_reason === "quiet_hours"
          ? withinSmsHours(now, marketing.campaign_sms_start_hour, marketing.campaign_sms_end_hour)
          : (await channelBlocker(container, campaign.channel)) === null
    if (ready) {
      await service.transition(campaign.id, ["paused"], "sending", {
        paused_reason: null,
        paused_day: null,
      })
    }
  }
}

/** Fixes the campaign's list when it first sends (adr/0050 §3); false when it cannot go. */
async function freezeOnce(container: MedusaContainer, campaign: Campaign, now: Date) {
  if (campaign.frozen_at) {
    return true
  }
  try {
    const sorted = await resolveAudience(container, {
      channel: campaign.channel,
      sources: campaign.audience as unknown as CampaignSource[],
      campaign_id: campaign.id,
      now,
    })
    await serviceOf(container).freeze(
      campaign.id,
      sorted.eligible.map(({ hash, ...rest }) => ({ recipient_hash: hash, ...rest })),
      { ...emptyCounts(), audience: sorted.audience, excluded: sorted.excluded }
    )
    return true
  } catch (error) {
    if (!isValidationError(error)) {
      throw error
    }
    // A source gone since (a segment deleted): nothing can be sent as approved
    await serviceOf(container).transition(campaign.id, ["sending"], "failed", {
      failure_reason: error.safeMessage,
      finished_at: now,
    })
    return false
  }
}

/** The counts from the rows as they stand, the reported rates beside them. */
async function recount(container: MedusaContainer, id: string, extra: Partial<CampaignCounts>) {
  const service = serviceOf(container)
  const [campaign] = await service.listBulkMessages({ id }, { take: 1, select: ["id", "counts"] })
  const counts = { ...tallied(countsOf(campaign?.counts), await service.tally(id)), ...extra }
  await service.updateBulkMessages({ id, counts })
  return counts
}

/**
 * One turn of the sending campaign (adr/0050 §6): the oldest one sending,
 * one campaign at a time (the job holds a lock). Its list is fixed on its
 * first turn; each turn sends to at most `batch` recipients, two a second,
 * each through deliver(). A full quota, the texts' hours or a channel off
 * pause it; past the complaint or bounce limit it stops and staff hear.
 */
export async function dispatchCampaigns(
  container: MedusaContainer,
  input: DispatchInput = {}
): Promise<DispatchResult> {
  const now = input.now ?? new Date()
  await wakeUp(container, now)
  const service = serviceOf(container)
  const [campaign] = await service.listBulkMessages(
    { status: "sending" },
    { take: 1, order: { started_at: "ASC" } }
  )
  if (!campaign) {
    return { campaign_id: null, sent: 0, status: null }
  }
  const result = (status: string, sent = 0) => ({ campaign_id: campaign.id, sent, status })
  if (await channelBlocker(container, campaign.channel)) {
    await pause(container, campaign, "channel_off", now)
    return result("paused")
  }
  const marketing = await marketingOf(container)
  if (
    campaign.channel === "sms" &&
    !withinSmsHours(now, marketing.campaign_sms_start_hour, marketing.campaign_sms_end_hour)
  ) {
    await pause(container, campaign, "quiet_hours", now)
    return result("paused")
  }
  if (!(await freezeOnce(container, campaign, now))) {
    return result("failed")
  }
  const rates = await reportedRates(container, campaign)
  const counts = await recount(container, campaign.id, rates)
  const passed = overLimit(counts, counts.review)
  if (passed) {
    await pause(container, campaign, "complaints", now)
    await warnStaff(container, campaign, passed)
    logger.warn({ event: "campaigns.paused_complaints", campaign_id: campaign.id, which: passed })
    return result("paused")
  }
  // The shop's own mail server sends at the pace it was given, so its address is not
  // listed as a spammer's (adr/0036 Ek 2026-11-10); Resend's limit otherwise
  const smtp = campaign.channel === "email" ? await shopSmtpAccount(container) : null
  const pace = smtp ? smtpPace(smtp) : null
  const turn = await sendTurn(container, campaign, {
    batch: Math.min(input.batch ?? 120, pace?.batch ?? Infinity),
    spacing: Math.max(input.spacing_ms ?? 500, pace?.spacingMs ?? 0),
    now,
  })
  const after = await recount(container, campaign.id, {})
  if (turn.stop) {
    await pause(container, campaign, turn.stop, now)
    return result("paused", turn.sent)
  }
  if (after.pending === 0) {
    await service.transition(campaign.id, ["sending"], "sent", { finished_at: new Date() })
    logger.info({ event: "campaigns.sent", campaign_id: campaign.id, sent: after.sent })
    return result("sent", turn.sent)
  }
  return result("sending", turn.sent)
}
