import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type {
  KindCounts,
  MigrationJob,
  MigrationMode,
  MigrationSourceKind,
} from "@/features/settings/api/migration"
import {
  isDescriptionRefresh,
  isPostImageRefresh,
  wordpressReportOf,
} from "@/features/settings/api/migration-wordpress"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { documentsOf, factsOf } from "@/features/settings/api/migration"
import {
  DocumentsLine,
  FactsLine,
  RefreshResult,
} from "@/features/settings/components/migration/description-result"
import { PostImagesResult } from "@/features/settings/components/migration/post-images-result"
import { WordpressReport } from "@/features/settings/components/migration/wordpress-report"
import { formatCount } from "@qticaret/admin-ui/lib/format"

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
  "post_category",
  "post_tag",
  "post",
  "page",
] as const

type Counts = Partial<Record<string, KindCounts>>

/** What each kind the source holds came to, or would come to in a dry run. */
function CountsTable({ mode, counts }: { mode: MigrationMode; counts: Counts }) {
  const { t } = useTranslation()
  const rows = KINDS.flatMap((kind) => {
    const own = counts[kind]
    return own && (own.read > 0 || own.created > 0) ? [{ kind, ...own }] : []
  })
  return (
    <div data-scroll-area="x" className="overflow-x-auto overflow-y-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[13px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t(`${R}.columns.kind`)}</th>
            <th className="px-3 py-2 text-right font-medium">{t(`${R}.columns.read`)}</th>
            <th className="px-3 py-2 text-right font-medium">
              {t(mode === "apply" ? `${R}.columns.created` : `${R}.columns.plannedCreated`)}
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
  )
}

/** A run's progress, then what each kind came to (with a WordPress run's own parts), and its report. */
export function RunResult({ job, source }: { job: MigrationJob; source: MigrationSourceKind }) {
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
  const summary = job.result_summary as { mode: MigrationMode; counts: Counts }
  // ADR-0055: a run that only rewrote the descriptions of products moved before
  const refresh = source === "wordpress" && isDescriptionRefresh(job.result_summary)
  // adr/0042 Ek 2026-11-27: a run that only added pictures to blog posts moved before
  const postImages = source === "wordpress" && isPostImageRefresh(job.result_summary)
  const documents = documentsOf(summary.counts)
  const facts = factsOf(summary.counts)
  const table = (
    <div className="flex flex-col gap-3">
      <CountsTable mode={summary.mode} counts={summary.counts} />
      {documents !== null ? <DocumentsLine mode={summary.mode} documents={documents} /> : null}
      {facts !== null ? <FactsLine mode={summary.mode} facts={facts} /> : null}
    </div>
  )
  const heading = postImages
    ? `${R}.postImages.${summary.mode === "apply" ? "applied" : "planned"}`
    : refresh
      ? summary.mode === "apply"
        ? `${R}.descriptions.applied`
        : `${R}.descriptions.planned`
      : summary.mode === "apply"
        ? `${R}.applied`
        : `${R}.planned`
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-sm font-medium">
        <CircleCheck className="h-lh w-4 shrink-0 text-success-text" aria-hidden="true" />
        {t(heading)}
      </p>
      {postImages ? (
        <PostImagesResult mode={summary.mode} counts={summary.counts} />
      ) : refresh ? (
        <RefreshResult mode={summary.mode} counts={summary.counts} />
      ) : source === "wordpress" ? (
        <WordpressReport counts={summary.counts} report={wordpressReportOf(job.result_summary)}>
          {table}
        </WordpressReport>
      ) : (
        table
      )}
      <div>
        <JobDownloadButton job={job} label={t(`${R}.report`)} />
      </div>
    </div>
  )
}
