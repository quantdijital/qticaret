import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, CircleCheck, Loader2, ScanSearch, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SEVERITY_TONES } from "@/features/seo/advisor/grades"
import type { Severity } from "@/features/seo/api/advisor"
import {
  AUDIT_JOB,
  isAuditRunning,
  lastReportQuery,
  latestAuditQuery,
} from "@/features/seo/api/audit"
import type { AuditFinding } from "@/features/seo/api/audit"
import type { AsyncJob } from "@/features/settings/api/activity"
import { useStartJob } from "@/features/settings/api/activity"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { errorText } from "@/lib/errors"
import { formatCount, formatRelative } from "@/lib/format"
import { AuditItemRow } from "./audit-item"

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"]

function Finding({ finding }: { finding: AuditFinding }) {
  const { t } = useTranslation()
  const key = `seo.audit.rules.${finding.ruleId}`
  const more = finding.count - finding.items.length
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          <StatusBadge tone={SEVERITY_TONES[finding.severity]}>
            {t(`seo.advisor.severities.${finding.severity}`)}
          </StatusBadge>
          <span className="min-w-0 flex-1 text-sm">
            {t(`${key}.title`, { count: finding.count, amount: formatCount(finding.count) })}
          </span>
        </summary>
        <div className="flex flex-col gap-2 pb-3 pl-7">
          <p className="text-[13px] leading-5 text-muted-foreground">{t(`${key}.why`)}</p>
          {finding.items.length > 0 ? (
            <ul className="flex flex-col divide-y rounded-md border px-3">
              {finding.items.map((item, index) => (
                <AuditItemRow
                  key={`${item.reason}-${item.subject}-${String(index)}`}
                  ruleId={finding.ruleId}
                  item={item}
                />
              ))}
            </ul>
          ) : null}
          {more > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("seo.audit.more", { count: more, amount: formatCount(more) })}
            </p>
          ) : null}
        </div>
      </details>
    </li>
  )
}

/** The last finished audit: when it ran, its findings by severity, each one to open. */
function Report({ job, findings }: { job: AsyncJob; findings: AuditFinding[] }) {
  const { t } = useTranslation()
  const bySeverity = SEVERITIES.map((severity) => ({
    severity,
    count: findings.filter((each) => each.severity === severity).length,
  })).filter((each) => each.count > 0)
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs text-muted-foreground">
          {t("seo.audit.last", { when: formatRelative(job.finished_at ?? job.created_at) })}
        </span>
        {bySeverity.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {bySeverity.map(({ severity, count }) => (
              <StatusBadge key={severity} tone={SEVERITY_TONES[severity]}>
                {t("seo.audit.findingCount", {
                  count,
                  severity: t(`seo.advisor.severities.${severity}`),
                })}
              </StatusBadge>
            ))}
          </span>
        ) : null}
      </div>
      {findings.length > 0 ? (
        <ul className="flex flex-col divide-y border-t">
          {findings.map((finding) => (
            <Finding key={finding.ruleId} finding={finding} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success-text">
          <CircleCheck className="size-4" aria-hidden="true" />
          {t("seo.audit.clean")}
        </p>
      )}
    </>
  )
}

/** Run now and download the last report. */
function Actions({ report, latest }: { report: AsyncJob | undefined; latest: AsyncJob | null }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const start = useStartJob()
  const isBusy = isAuditRunning(latest) || start.isPending
  const run = () => {
    start.mutate(
      { type: AUDIT_JOB, input: {} },
      {
        onSuccess: () => {
          toast.success(t("seo.audit.queued"))
          void client.invalidateQueries({ queryKey: ["seo", "audit", "latest"] })
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <>
      {report ? <JobDownloadButton job={report} label={t("seo.audit.download")} /> : null}
      <Button size="sm" disabled={isBusy} onClick={run}>
        {isBusy ? <Loader2 className="animate-spin" /> : <ScanSearch />}
        {isAuditRunning(latest) ? t("seo.audit.running") : t("seo.audit.run")}
      </Button>
    </>
  )
}

/**
 * The store-wide SEO audit (docs/14 §3.9): run every night after the
 * pages' assessments, or on request. What keeps search engines out or
 * lost, and what the pages add up to, most severe first; each finding
 * opens to its items and the way to fix them, the report file has all.
 */
export function AuditCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const latest = useQuery(latestAuditQuery())
  const finishedId = latest.data && !isAuditRunning(latest.data) ? latest.data.id : null
  const report = useQuery({ ...lastReportQuery(finishedId), enabled: latest.isSuccess })
  const failure = latest.error ?? report.error
  return (
    <SectionCard
      title={t("seo.audit.title")}
      description={t("seo.audit.hint")}
      className={className}
      action={
        latest.isSuccess ? <Actions report={report.data?.job} latest={latest.data} /> : undefined
      }
    >
      {failure ? (
        <ErrorState
          text={errorText(t, failure)}
          onRetry={() => {
            void latest.refetch()
            void report.refetch()
          }}
        />
      ) : !latest.isSuccess || report.isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="flex flex-col gap-3">
          {latest.data?.status === "failed" ? (
            <p className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("seo.audit.failed")}
            </p>
          ) : null}
          {report.data ? (
            <Report job={report.data.job} findings={report.data.findings} />
          ) : (
            <p className="text-[13px] text-muted-foreground">{t("seo.audit.never")}</p>
          )}
        </div>
      )}
    </SectionCard>
  )
}
