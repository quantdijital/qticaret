import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type { SheetJob } from "@/features/products/api/sheets"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import type { FactsSummary } from "./types"

const F = "attributes.facts"
const count = (value: number) => ({ count: value, formatted: formatCount(value) })

/** The run's progress, then what it wrote and left, and its report (a row per product). */
export function FactsResult({ job }: { job: SheetJob }) {
  const { t } = useTranslation()
  if (job.status === "queued" || job.status === "running") {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t(`${F}.working`)}
        </p>
        <Progress value={job.progress ?? 0} aria-label={t(`${F}.working`)} />
      </div>
    )
  }
  if (job.status !== "succeeded" || !job.result_summary) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {job.error_message ?? t(`${F}.jobFailed`)}
      </p>
    )
  }
  const summary = job.result_summary as unknown as FactsSummary
  const left = summary.skipped + summary.failed
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <CircleCheck className="h-lh w-4 shrink-0 text-success-text" aria-hidden="true" />
          {t(`${F}.written`, {
            ...count(summary.changed),
            values: formatCount(summary.values),
          })}
        </p>
        {summary.fields_added + summary.aliases_added > 0 ? (
          <p className="text-muted-foreground">
            {t(`${F}.templateChanged`, {
              fields: formatCount(summary.fields_added),
              aliases: formatCount(summary.aliases_added),
            })}
          </p>
        ) : null}
        {summary.unchanged > 0 ? (
          <p className="text-muted-foreground">{t(`${F}.unchanged`, count(summary.unchanged))}</p>
        ) : null}
        {left > 0 ? (
          <p className="flex items-start gap-2 text-warning-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t(`${F}.left`, count(left))}
          </p>
        ) : null}
      </div>
      <div>
        <JobDownloadButton job={job} label={t(`${F}.report`)} />
      </div>
    </div>
  )
}
