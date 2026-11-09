import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@/components/ui/progress"
import type { BulkSummary } from "@/features/products/api/bulk"
import type { SheetJob } from "@/features/products/api/sheets"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { formatCount } from "@/lib/format"

const count = (value: number) => ({ count: value, formatted: formatCount(value) })

/** A bulk edit's progress, then what it changed and left, and its report. */
export function BulkJobResult({ job }: { job: SheetJob }) {
  const { t } = useTranslation()
  if (job.status === "queued" || job.status === "running") {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("products.bulk.working")}
        </p>
        <Progress value={job.progress ?? 0} aria-label={t("products.bulk.working")} />
      </div>
    )
  }
  if (job.status !== "succeeded" || !job.result_summary) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {job.error_message ?? t("products.bulk.jobFailed")}
      </p>
    )
  }
  const summary = job.result_summary as unknown as BulkSummary
  const left = summary.skipped + summary.failed
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <CircleCheck className="h-lh w-4 shrink-0 text-success-text" aria-hidden="true" />
          {t("products.bulk.changed", count(summary.changed))}
        </p>
        {summary.unchanged > 0 ? (
          <p className="text-muted-foreground">
            {t("products.bulk.unchanged", count(summary.unchanged))}
          </p>
        ) : null}
        {left > 0 ? (
          <p className="flex items-start gap-2 text-warning-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("products.bulk.left", count(left))}
          </p>
        ) : null}
      </div>
      <div>
        <JobDownloadButton job={job} label={t("products.bulk.report")} />
      </div>
    </div>
  )
}
