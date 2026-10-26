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

const latestJob = async (status?: AsyncJob["status"]) =>
  (
    await sdk.client.fetch<{ async_jobs: AsyncJob[] }>("/admin/async-jobs", {
      query: { type: AUDIT_JOB, limit: 1, ...(status ? { status } : {}) },
    })
  ).async_jobs[0] ?? null

export const isAuditRunning = (job: AsyncJob | null | undefined) =>
  job?.status === "queued" || job?.status === "running"

/** The last audit asked for, whatever its state: looked at again while it runs. */
export const latestAuditQuery = () =>
  queryOptions({
    queryKey: ["seo", "audit", "latest"],
    queryFn: () => latestJob(),
    refetchInterval: (query) => (isAuditRunning(query.state.data) ? 3000 : false),
  })

/**
 * The last audit that finished, and its findings; `latestId` (the last
 * run asked for, once over) reads it again after a run.
 */
export const lastReportQuery = (latestId: string | null) =>
  queryOptions({
    queryKey: ["seo", "audit", "report", latestId],
    queryFn: async () => {
      const job = await latestJob("succeeded")
      const summary = job?.result_summary as { findings?: AuditFinding[] } | null | undefined
      return job ? { job, findings: summary?.findings ?? [] } : null
    },
  })
