import { model } from "@medusajs/framework/utils"

/** Where a bulk message stands (adr/0050 §2): `sending ⇄ paused`, then `sent`. */
export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "paused",
  "sent",
  "cancelled",
  "failed",
] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

/**
 * Why a campaign waits: staff paused it, the day's quota ran out, texts are
 * outside their hours, complaints or bounces passed their limit, or the
 * channel cannot send (no sender, no SMS account).
 */
export const PAUSE_REASONS = ["staff", "quota", "quiet_hours", "complaints", "channel_off"] as const
export type PauseReason = (typeof PAUSE_REASONS)[number]

/**
 * One bulk e-mail or SMS, a "campaign" in adr/0050 §2 (the table is
 * `bulk_message`: Medusa's promotion module owns the `campaign` entity and
 * `/admin/campaigns`): its audience, content, schedule
 * and counts. Nothing personal: who it went to is in `bulk_message_recipient`,
 * by keyed hash and record id only. The content is locked once sending
 * starts; a change is a copy.
 */
export const BulkMessage = model
  .define("bulk_message", {
    id: model.id({ prefix: "camp" }).primaryKey(),
    name: model.text(),
    channel: model.enum(["email", "sms"]),
    /** `CampaignSource[]` (lib/campaigns/types.ts): segments, groups, all consented, the newsletter. */
    audience: model.json(),
    subject: model.text().nullable(),
    preheader: model.text().nullable(),
    /** The e-mail's body: a content document (adr/0019). */
    body: model.json().nullable(),
    sms_text: model.text().nullable(),
    /** The `utm_campaign` its links carry and the sales report finds it by. */
    utm_campaign: model.text(),
    status: model.enum([...CAMPAIGN_STATUSES]).default("draft"),
    paused_reason: model.enum([...PAUSE_REASONS]).nullable(),
    /** The quota day (UTC, as the counters keep it) a quota pause began on. */
    paused_day: model.text().nullable(),
    failure_reason: model.text().nullable(),
    scheduled_at: model.dateTime().nullable(),
    started_at: model.dateTime().nullable(),
    /** When its recipients were fixed; null until the first send. */
    frozen_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
    /** When its recipients went, 90 days after it finished (adr/0050 §8). */
    recipients_pruned_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
    /** Who sent or scheduled it, proving themselves again (adr/0040). */
    sent_by: model.text().nullable(),
    /** `CampaignCounts`: numbers only, kept after the recipients go. */
    counts: model.json(),
  })
  .indexes([
    { on: ["utm_campaign"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])
