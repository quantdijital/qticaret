import { DEFAULT_MAX_SKEW_SECONDS } from "@qticaret/server-kit"
import { usagePeriodOf, usageReportSchema } from "@qticaret/types/control-plane"
import type { UsageReport } from "@qticaret/types/control-plane"

/**
 * What the control plane takes of a shop's signed usage report (adr/0061
 * §3.1, §5.4, Ek C13), once its signature passed:
 *
 * - the exact bytes signed, parsed as JSON and held to the contract's
 *   strict schema: an unknown field anywhere is 400 `usage.invalid`
 * - its `tenant_id` is the signer's: another shop's is 403 `usage.wrong_tenant`
 * - its own time within ±5 minutes of ours, the signed request's window:
 *   older or ahead is 400 `usage.stale`
 * - its `period` is its time's month in Turkey; its last order no later
 *   than its own time (with the same slack): else 400 `usage.inconsistent`
 *
 * Then the store keeps it only when it is newer than the shop's latest
 * snapshot: an older or equal one is 409 `usage.out_of_order` (a refusal,
 * not a silent success: the shop's log says so, and a replay with a fresh
 * nonce changes nothing either way).
 */

export const USAGE_MAX_SKEW_MS = DEFAULT_MAX_SKEW_SECONDS * 1000

export type UsageCheck =
  { ok: true; report: UsageReport } | { ok: false; status: 400 | 403; message: string }

const refuse = (status: 400 | 403, message: string): UsageCheck => ({ ok: false, status, message })

export function checkUsageReport(raw: string, signerTenantId: string, now: Date): UsageCheck {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return refuse(400, "usage.invalid")
  }
  const parsed = usageReportSchema.safeParse(json)
  if (!parsed.success) {
    return refuse(400, "usage.invalid")
  }
  const report = parsed.data
  if (report.tenant_id !== signerTenantId) {
    return refuse(403, "usage.wrong_tenant")
  }
  const at = new Date(report.reported_at)
  if (Math.abs(now.getTime() - at.getTime()) > USAGE_MAX_SKEW_MS) {
    return refuse(400, "usage.stale")
  }
  const lastOrder = report.last_order_at ? new Date(report.last_order_at).getTime() : null
  if (
    report.period !== usagePeriodOf(at) ||
    (lastOrder !== null && lastOrder > at.getTime() + USAGE_MAX_SKEW_MS)
  ) {
    return refuse(400, "usage.inconsistent")
  }
  return { ok: true, report }
}
