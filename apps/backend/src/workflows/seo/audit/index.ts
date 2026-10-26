import type { MedusaContainer } from "@medusajs/framework/types"
import type { AuditFinding } from "../../../lib/seo/audit"
import { duplicateFinding, notFoundFinding, productFindings } from "./catalog"
import { redirectFinding } from "./redirects"
import { siteFindings } from "./site"

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const

type Check = (
  container: MedusaContainer,
  now: Date
) => Promise<AuditFinding | null | (AuditFinding | null)[]>

const CHECKS: readonly Check[] = [
  siteFindings,
  notFoundFinding,
  duplicateFinding,
  productFindings,
  redirectFinding,
]

/**
 * The store-wide SEO audit (docs/14 §3.9, F3.14): whether search engines
 * can get in and find their way (host, robots.txt, sitemap), and what the
 * pages add up to (404s worth a redirect, shared titles, products in no
 * category, images without alt text, redirects to tidy). Findings most severe first, the biggest
 * first within a severity. `progress` hears of each check done (the job's
 * heartbeat).
 */
export async function runSeoAudit(
  container: MedusaContainer,
  { now = new Date(), progress }: { now?: Date; progress?: (percent: number) => Promise<void> } = {}
): Promise<AuditFinding[]> {
  const findings: (AuditFinding | null)[] = []
  for (const [index, check] of CHECKS.entries()) {
    findings.push(...[await check(container, now)].flat())
    await progress?.(5 + Math.round(((index + 1) / CHECKS.length) * 85))
  }
  return findings
    .filter((each): each is AuditFinding => each !== null)
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.count - a.count
    )
}
