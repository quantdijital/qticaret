import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type { BulkPreview, BulkProblem, BulkSummary } from "@/features/products/api/bulk"
import type { SheetJob } from "@/features/products/api/sheets"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const count = (value: number) => ({ count: value, formatted: formatCount(value) })

/** Products left out or failed, each with why; the first ones the server named. */
export function BulkProblems({ problems }: { problems: readonly BulkProblem[] }) {
  const { t } = useTranslation()
  if (problems.length === 0) {
    return null
  }
  return (
    <ul
      aria-label={t("products.bulk.problems")}
      data-scroll-area="y"
      className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md border px-3 py-2 text-[13px]"
    >
      {problems.map((problem) => (
        <li key={problem.handle} className="flex flex-col">
          <span className="font-medium">{problem.title ?? problem.handle}</span>
          <span className="text-muted-foreground">{problem.message}</span>
        </li>
      ))}
    </ul>
  )
}

/** What a change would do, before it is applied: how many change, are so already, are left out and why. */
export function BulkPreviewResult({ preview }: { preview: BulkPreview }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <CircleCheck className="h-lh w-4 shrink-0 text-success-text" aria-hidden="true" />
          {t("products.bulk.willChange", count(preview.changed))}
        </p>
        {preview.unchanged > 0 ? (
          <p className="text-muted-foreground">
            {t("products.bulk.willStay", count(preview.unchanged))}
          </p>
        ) : null}
        {preview.skipped > 0 ? (
          <p className="flex items-start gap-2 text-warning-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("products.bulk.willSkip", count(preview.skipped))}
          </p>
        ) : null}
      </div>
      {preview.booking_off ? (
        // adr/0076 Ek D2: what the product page asks before a dated product stops being one
        <div
          role="alert"
          className="flex flex-col gap-1.5 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[13px]"
        >
          <p className="font-medium">
            {t("products.bulk.kind.bookingOff", count(preview.booking_off))}
          </p>
          <p>{t("products.booking.off.description")}</p>
          <p>{t("products.booking.off.stock")}</p>
        </div>
      ) : null}
      <BulkProblems problems={preview.problems} />
    </div>
  )
}

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
      <BulkProblems problems={summary.problems ?? []} />
      <div>
        <JobDownloadButton job={job} label={t("products.bulk.report")} />
      </div>
    </div>
  )
}
