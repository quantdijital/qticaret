import { useQuery } from "@tanstack/react-query"
import { advisorSummaryQuery } from "@/features/seo/api/advisor"
import { auditQuery } from "@/features/seo/api/audit"
import { redirectCountsQuery } from "@/features/seo/api/redirects"
import { seoSetupQuery } from "@/features/seo/api/setup"
import type { SeoPart } from "@/features/seo/parts"

/**
 * What waits in each of Settings > SEO's tabs, beside its name: setup's
 * open steps, the products with a critical finding, the last audit's
 * findings, the 404s no redirect answers yet. None while not known.
 */
export function useSeoPartCounts(): Partial<Record<SeoPart, number | undefined>> {
  const setup = useQuery(seoSetupQuery())
  const advisor = useQuery(advisorSummaryQuery())
  const audit = useQuery(auditQuery())
  const redirects = useQuery(redirectCountsQuery())
  return {
    overview: setup.data?.items.filter((entry) => !entry.done).length,
    advisor: advisor.data?.critical,
    audit: audit.data?.report?.findings.length,
    redirects: redirects.data?.missing,
  }
}
