import type { JSONContent } from "@tiptap/react"

/**
 * Bulk e-mail and SMS (adr/0050) as the API gives them: the backend's
 * `/admin/bulk-messages*` routes and their views (`api/admin/bulk-messages`).
 * Numbers only: nothing here names a recipient.
 */

/** The flag the screen and its routes live behind; off, the API answers nothing. */
export const BULK_MESSAGES_FLAG = "marketing.campaigns"

export const BULK_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "paused",
  "sent",
  "cancelled",
  "failed",
] as const
export type BulkStatus = (typeof BULK_STATUSES)[number]

export const BULK_CHANNELS = ["email", "sms"] as const
export type BulkChannel = (typeof BULK_CHANNELS)[number]

/** Why a sending campaign waits (`paused_reason`). */
export const PAUSE_REASONS = ["staff", "quota", "quiet_hours", "complaints", "channel_off"] as const
export type PauseReason = (typeof PAUSE_REASONS)[number]

/** Why someone in the audience gets nothing: left out before sending, or at send time. */
export const SKIP_REASONS = [
  "no_consent",
  "suppressed",
  "iys_pending",
  "recent",
  "invalid_recipient",
  "over_quota",
] as const
export type SkipReason = (typeof SKIP_REASONS)[number]
export type SkipCounts = Record<SkipReason, number>

/** Where the audience comes from; several make a union, each person once. */
export type AudienceSource =
  | { kind: "segment"; id: string }
  | { kind: "group"; id: string }
  | { kind: "all_consented" }
  | { kind: "newsletter" }

export type AudienceKind = AudienceSource["kind"]

/** `shownCounts` in the backend. */
export interface BulkCounts {
  audience: number
  targeted: number
  pending: number
  sent: number
  failed: number
  skipped: SkipCounts
  bounces: number
  complaints: number
  unsubscribed: number
}

/** A row of `GET /admin/bulk-messages` (`campaignSummary`). */
export interface BulkMessageSummary {
  id: string
  name: string
  channel: BulkChannel
  audience: AudienceSource[]
  status: BulkStatus
  paused_reason: PauseReason | null
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  counts: BulkCounts
  created_at: string
  updated_at: string
}

/** One campaign as its editor opens it (`campaignView`). */
export interface BulkMessage extends BulkMessageSummary {
  subject: string | null
  preheader: string | null
  body: JSONContent | null
  sms_text: string | null
  utm_campaign: string
  /** An i18n key (`campaigns.segment_unknown`) when the campaign failed. */
  failure_reason: string | null
  created_by: string | null
  sent_by: string | null
  /** A draft: its content may change. */
  editable: boolean
}

export interface BulkMessageList {
  campaigns: BulkMessageSummary[]
  count: number
  limit: number
  offset: number
}

/** What a draft is written with (`AdminPostCampaign` / `AdminUpdateCampaign`). */
export interface BulkMessageInput {
  name: string
  channel: BulkChannel
  audience: AudienceSource[]
  subject: string | null
  preheader: string | null
  body: JSONContent | null
  sms_text: string | null
}

/** `POST /admin/bulk-messages/:id/audience-preview`. */
export interface AudiencePreview {
  channel: BulkChannel
  /** Everyone the sources name, each once. */
  audience: number
  /** Who would get it now. */
  eligible: number
  excluded: SkipCounts
  /** What today's quota sends today, and what waits for the next day. */
  quota: { limit: number; left: number; today: number; later: number }
  /** From the stored text, not the one being typed. */
  sms: { parts: number; max_parts: number } | null
}

/**
 * `GET /admin/bulk-messages/:id/preview?channel=`: the stored campaign made
 * as a send makes it, the asking staff member its sample recipient (their
 * own name for `{ad}`, a dead way out). A text's `parts` is counted at its
 * longest (the longest first name, the shop links' utm), as the save check
 * counts it: the text shown may be shorter.
 */
export type RenderedPreview =
  { subject: string; preheader: string; html: string } | { text: string; parts: number }

/** `GET /admin/bulk-messages/:id/report`. */
export interface BulkReport {
  id: string
  name: string
  channel: BulkChannel
  status: BulkStatus
  paused_reason: PauseReason | null
  utm_campaign: string
  started_at: string | null
  finished_at: string | null
  counts: BulkCounts
  /** What its links brought within the week; none before it started. */
  traffic: { carts: number; orders: number; revenue: number } | null
}

/** `POST /admin/bulk-messages/:id/test-send`: the masked address it went to. */
export interface TestSendResult {
  sent: boolean
  channel: BulkChannel
  to: string
}
