import { queryOptions } from "@tanstack/react-query"
import type { AdvisorKind, Severity } from "@/features/seo/api/advisor"
import type { AsyncJob } from "@/features/settings/api/activity"
import { sdk } from "@/lib/sdk"

/** The store-wide SEO audit (docs/14 §3.9): an async job whose summary holds its findings. */

export const AUDIT_JOB = "seo.audit"

export type AuditRuleId =
  | "S-HOST-01"
  | "S-ROBOTS-01"
  | "S-SITEMAP-01"
  | "S-404-01"
  | "S-DUP-01"
  | "S-ORPHAN-01"
  | "S-REDIR-01"
  | "S-IMG-01"
  | "S-SEARCH-01"
  | "S-GSC-01"
  | "S-CWV-01"

export interface AuditItem {
  reason: string
  subject: string
  count?: number
  target?: string
  entity?: { kind: AdvisorKind; id: string }
}

export interface AuditFinding {
  ruleId: AuditRuleId
  severity: Severity
  count: number
  /** The first few; the report file lists the rest. */
  items: AuditItem[]
}

/** The last run asked for, whatever its state: the night's or one staff started. */
export interface AuditRun {
  id: string
  status: AsyncJob["status"]
  progress: number | null
  created_at: string
  finished_at: string | null
}

/** The last run that finished: its findings, and whether its report file is still kept. */
export interface AuditReport {
  id: string
  created_at: string
  finished_at: string | null
  findings: AuditFinding[]
  has_file: boolean
}

export const isAuditRunning = (run: AuditRun | null | undefined) =>
  run?.status === "queued" || run?.status === "running"

/**
 * The audit as the SEO page shows it (`GET /admin/seo/audit`): the night's
 * runs are not in the shop's jobs list (docs/06 principle 10), so the page
 * reads its own. Looked at again while a run is on its way.
 */
export const auditQuery = () =>
  queryOptions({
    queryKey: ["seo", "audit"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ audit: { latest: AuditRun | null; report: AuditReport | null } }>(
          "/admin/seo/audit"
        )
      ).audit,
    refetchInterval: (query) => (isAuditRunning(query.state.data?.latest) ? 3000 : false),
  })

/** A short-lived link to the last finished audit's CSV. */
export const auditReportUrl = async () =>
  (await sdk.client.fetch<{ url: string }>("/admin/seo/audit/report")).url
