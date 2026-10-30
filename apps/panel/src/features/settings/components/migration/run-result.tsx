import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@/components/ui/progress"
import type { KindCounts, MigrationJob, MigrationMode } from "@/features/settings/api/migration"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { formatCount } from "@/lib/format"

const R = "settings.migration.run"
// The report's kinds, in the order a run takes them
const KINDS = [
  "category",
  "brand",
  "product",
  "image",
  "customer",
  "consent",
  "order",
  "review",
  "page",
] as const

/** A run's progress, then what each kind came to, and its report. */
export function RunResult({ job }: { job: MigrationJob }) {
  const { t } = useTranslation()
  if (job.status === "queued" || job.status === "running") {
    const progress = Math.round(job.progress ?? 0)
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t(`${R}.running`, { progress })}
        </p>
        <Progress value={progress} aria-label={t(`${R}.running`, { progress })} />
      </div>
    )
  }
  if (job.status !== "succeeded" || !job.result_summary) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t(`${R}.failed`, { reason: job.error_message ?? "" })}
      </p>
    )
  }
  const summary = job.result_summary as {
    mode: MigrationMode
    counts: Partial<Record<string, KindCounts>>
  }
  const rows = KINDS.flatMap((kind) => {
    const own = summary.counts[kind]
    return own && (own.read > 0 || own.created > 0) ? [{ kind, ...own }] : []
  })
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-4 text-success-text" aria-hidden="true" />
        {t(summary.mode === "apply" ? `${R}.applied` : `${R}.planned`)}
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[13px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t(`${R}.columns.kind`)}</th>
              <th className="px-3 py-2 text-right font-medium">{t(`${R}.columns.read`)}</th>
              <th className="px-3 py-2 text-right font-medium">
                {t(
                  summary.mode === "apply" ? `${R}.columns.created` : `${R}.columns.plannedCreated`
                )}
              </th>
              <th className="px-3 py-2 text-right font-medium">{t(`${R}.columns.found`)}</th>
              <th className="px-3 py-2 text-right font-medium">{t(`${R}.columns.skipped`)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.kind} className="border-t">
                <td className="px-3 py-2">{t(`${R}.kinds.${row.kind}`)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.read)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.created)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.found)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCount(row.skipped + row.failed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <JobDownloadButton job={job} label={t(`${R}.report`)} />
      </div>
    </div>
  )
}
