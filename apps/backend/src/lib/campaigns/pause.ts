/**
 * When a sending campaign waits (adr/0050 §6): complaints or bounces past
 * the mailbox providers' limits, a text outside its hours, the quota day.
 */

/** Sends a campaign makes before its rates are judged: a few complaints early say little. */
export const RATE_MIN_SENT = 200
/** Gmail's and Yahoo's limit for bulk senders: under 0.3% spam complaints. */
export const COMPLAINT_LIMIT = 0.003
/** Hard bounces past this share mean an old or bought list. */
export const BOUNCE_LIMIT = 0.05

export interface RateFacts {
  sent: number
  bounces: number
  complaints: number
}

/**
 * Which limit the campaign passed, or null. After staff resumed it from
 * an automatic stop (`since`), only what came after counts, again from
 * RATE_MIN_SENT sends: the same complaints never stop it twice.
 */
export function overLimit(
  facts: RateFacts,
  since: RateFacts | null = null
): "complaints" | "bounces" | null {
  const sent = facts.sent - (since?.sent ?? 0)
  if (sent < RATE_MIN_SENT) {
    return null
  }
  if ((facts.complaints - (since?.complaints ?? 0)) / sent > COMPLAINT_LIMIT) {
    return "complaints"
  }
  if ((facts.bounces - (since?.bounces ?? 0)) / sent > BOUNCE_LIMIT) {
    return "bounces"
  }
  return null
}

/** The hour in Türkiye (UTC+3 all year since 2016). */
export const trHour = (now: Date): number => (now.getUTCHours() + 3) % 24

/** Whether a text may go now: from `start` to before `end`, Türkiye time. */
export const withinSmsHours = (now: Date, start: number, end: number): boolean => {
  const hour = trHour(now)
  return hour >= start && hour < end
}

/** The quota's day, as its counters key it (UTC: it turns at 03:00 in Türkiye). */
export const quotaDay = (now: Date): string => now.toISOString().slice(0, 10)
