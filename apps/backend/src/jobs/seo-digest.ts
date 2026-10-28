import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { alertStaff } from "../workflows/messaging/staff"

/** The ISO week a date falls in, as `2026-W44`: one digest a week, however often it runs. */
export function isoWeek(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${String(day.getUTCFullYear())}-W${String(week).padStart(2, "0")}`
}

/**
 * Monday morning's SEO summary to the staff list (F9.7, docs/14 §5): the
 * products' average score, critical findings and the five lowest, after
 * the nightly assessment. Sent once a week (the week names the message).
 */
export default async function seoDigest(container: MedusaContainer) {
  const week = isoWeek(new Date())
  const sent = await alertStaff(container, { template: "staff.seo_digest", resource_id: week })
  logger.info({ event: "seo.digest", week, sent })
}

export const config = {
  name: "seo-digest",
  // Mondays 06:00 UTC (09:00 in Türkiye), after the nightly assessment
  schedule: "0 6 * * 1",
}
