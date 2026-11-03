import { z } from "@medusajs/framework/zod"

/**
 * Bulk messages (adr/0050): who a campaign goes to and what it counts.
 * Numbers only: a campaign keeps no address, nor a name.
 */

export type CampaignChannel = "email" | "sms"

const recordId = z.string().regex(/^[a-z]+_[0-9A-Z]{26}$/)

/** Where a campaign's audience comes from; several make a union (adr/0050 §3). */
export const campaignSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("segment"), id: recordId }).strict(),
  z.object({ kind: z.literal("group"), id: recordId }).strict(),
  // Every customer whose address consented on the channel
  z.object({ kind: z.literal("all_consented") }).strict(),
  // Consents with no customer record behind them: the storefront's newsletter box
  z.object({ kind: z.literal("newsletter") }).strict(),
])
export type CampaignSource = z.infer<typeof campaignSource>

export const campaignAudience = z.array(campaignSource).min(1).max(10)

/** Why a person in the audience gets nothing: left out when it starts, or by deliver(). */
export const SKIP_REASONS = [
  "no_consent",
  "suppressed",
  "iys_pending",
  "recent",
  "invalid_recipient",
  "over_quota",
] as const
export type SkipReason = (typeof SKIP_REASONS)[number]

/** What the frozen list left out: decided before any send. */
export type ExclusionReason = Exclude<SkipReason, "over_quota">

export type SkipCounts = Record<SkipReason, number>

export interface CampaignCounts {
  /** Everyone the sources name, each person once. */
  audience: number
  /** Fixed to receive it when sending started. */
  targeted: number
  pending: number
  sent: number
  failed: number
  /** Left out when it started (`excluded`) and at send time, by reason. */
  skipped: SkipCounts
  /** What the frozen list left out, kept apart from the rows' own reasons. */
  excluded: SkipCounts
  /** Hard bounces and spam complaints Resend reported for its recipients. */
  bounces: number
  complaints: number
  /** Consents its recipients withdrew within 7 days of it. */
  unsubscribed: number
  /** Sent, bounces and complaints when staff resumed it after an automatic stop. */
  review: { sent: number; bounces: number; complaints: number } | null
}

export const noSkips = (): SkipCounts => ({
  no_consent: 0,
  suppressed: 0,
  iys_pending: 0,
  recent: 0,
  invalid_recipient: 0,
  over_quota: 0,
})

export const emptyCounts = (): CampaignCounts => ({
  audience: 0,
  targeted: 0,
  pending: 0,
  sent: 0,
  failed: 0,
  skipped: noSkips(),
  excluded: noSkips(),
  bounces: 0,
  complaints: 0,
  unsubscribed: 0,
  review: null,
})

/** Stored counts read back; a field missing (an older row) reads as zero. */
export function countsOf(value: unknown): CampaignCounts {
  const stored = (value ?? {}) as Partial<CampaignCounts>
  const base = emptyCounts()
  return {
    ...base,
    ...stored,
    skipped: { ...base.skipped, ...stored.skipped },
    excluded: { ...base.excluded, ...stored.excluded },
    review: stored.review ?? null,
  }
}

/** The counts as staff see them: what the list left out is in `skipped`, the review point stays inside. */
export function shownCounts(counts: CampaignCounts) {
  return {
    audience: counts.audience,
    targeted: counts.targeted,
    pending: counts.pending,
    sent: counts.sent,
    failed: counts.failed,
    skipped: counts.skipped,
    bounces: counts.bounces,
    complaints: counts.complaints,
    unsubscribed: counts.unsubscribed,
  }
}

export const isSkipReason = (value: string | null): value is SkipReason =>
  value !== null && (SKIP_REASONS as readonly string[]).includes(value)

/** The row counts of a campaign's recipients, by status and reason. */
export interface RecipientTally {
  status: "pending" | "sent" | "skipped" | "failed"
  reason: string | null
  count: number
}

/** The counts with the recipients' rows as they stand now. */
export function tallied(counts: CampaignCounts, rows: readonly RecipientTally[]): CampaignCounts {
  const by = (status: RecipientTally["status"]) =>
    rows.filter((row) => row.status === status).reduce((sum, row) => sum + row.count, 0)
  const skipped = { ...counts.excluded }
  for (const row of rows) {
    if (row.status === "skipped" && isSkipReason(row.reason)) {
      skipped[row.reason] += row.count
    }
  }
  return {
    ...counts,
    targeted: rows.reduce((sum, row) => sum + row.count, 0),
    pending: by("pending"),
    sent: by("sent"),
    failed: by("failed"),
    skipped,
  }
}
