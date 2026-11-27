import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { AlertTriangle, CircleCheck, Loader2, Play, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { MIGRATION_KEY, migrationJobQuery } from "@/features/settings/api/migration"
import { productSourceOf } from "@/features/settings/api/migration-overview"
import type { MigrationOverview } from "@/features/settings/api/migration-overview"
import { CompletionDialog } from "@/features/settings/components/migration/completion-dialog"
import {
  doneValues,
  inputOf,
  rowsFor,
} from "@/features/settings/components/migration/completion-rows"
import type {
  CompletionKey,
  CompletionRow,
} from "@/features/settings/components/migration/completion-rows"
import { useStartCompletion } from "@/features/settings/components/migration/use-completion"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const C = "settings.migration.completions"

/** Where a row's last job stands, in one line: running, stopped, or what it did. */
function RowStatus({ row, jobId }: { row: CompletionKey; jobId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const job = useQuery(migrationJobQuery(jobId))
  const status = job.data?.status
  const finished = status === "succeeded" || status === "failed" || status === "cancelled"
  useEffect(() => {
    if (finished) {
      // The tiles and the counts move with what it did
      void client.invalidateQueries({ queryKey: [...MIGRATION_KEY, "overview"] })
    }
  }, [finished, client])
  if (!job.data || status === "queued" || status === "running") {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        {t(`${C}.running`, { progress: Math.round(job.data?.progress ?? 0) })}
      </p>
    )
  }
  if (status !== "succeeded") {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-destructive" role="alert">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {t(`${C}.failed`, { reason: job.data.error_message ?? "" })}
      </p>
    )
  }
  const values = doneValues(row, job.data.result_summary)
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-success-text" role="status">
      <CircleCheck className="size-3.5" aria-hidden="true" />
      {t(
        `${C}.rows.${row}.done`,
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, formatCount(value)]))
      )}
    </p>
  )
}

interface RowProps {
  row: CompletionRow
  overview: MigrationOverview
  jobId: string | undefined
  busy: boolean
  onOpen: () => void
}

/** One completion: its name, one sentence of what it touches and not, its count and its button. */
function Row({ row, overview, jobId, busy, onOpen }: RowProps) {
  const { t } = useTranslation()
  const count = row.count(overview)
  const none = count === 0
  return (
    <li
      className="grid gap-x-4 gap-y-2 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      data-testid={`completion-${row.key}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 md:justify-start">
          <h3 className="text-sm font-medium">{t(`${C}.rows.${row.key}.title`)}</h3>
          {count !== null ? (
            <span
              className={cn(
                "text-[13px] tabular-nums",
                none ? "text-muted-foreground" : "font-medium text-warning-text"
              )}
            >
              {none
                ? t(`${C}.none`)
                : t(`${C}.rows.${row.key}.count`, { count, formatted: formatCount(count) })}
            </span>
          ) : null}
        </div>
        <p className="text-[13px] text-muted-foreground">{t(`${C}.rows.${row.key}.text`)}</p>
        {jobId ? <RowStatus row={row.key} jobId={jobId} /> : null}
      </div>
      {row.key === "new" ? (
        <Button asChild variant="outline" className="w-full md:w-36">
          <Link to="/settings/migration/new">
            <Plus />
            {t(`${C}.start`)}
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          className={cn("w-full md:w-36", none && "text-muted-foreground")}
          disabled={busy}
          onClick={onOpen}
        >
          <Play />
          {t(`${C}.start`)}
        </Button>
      )}
    </li>
  )
}

/**
 * "Tamamlama işlemleri" (adr/0042 Ek 2026-11-27): each takes one part of
 * what moved again and nothing else; a count of what it would take (none
 * missing says so, the button stays: a warning, not a block); one dialog
 * for all, then the row follows its job to what it did.
 */
export function CompletionsCard({ overview }: { overview: MigrationOverview | undefined }) {
  const { t } = useTranslation()
  const source = productSourceOf(overview)
  const completion = useStartCompletion(source)
  const [open, setOpen] = useState<CompletionKey | null>(null)
  const [jobs, setJobs] = useState<Partial<Record<CompletionKey, string>>>({})
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)} flush>
      {!overview ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-40 rounded-md" />
        </div>
      ) : (
        <ul className="flex flex-col divide-y border-t">
          {rowsFor(source).map((row) => (
            <Row
              key={row.key}
              row={row}
              overview={overview}
              jobId={jobs[row.key]}
              busy={completion.pending}
              onOpen={() => {
                setOpen(row.key)
              }}
            />
          ))}
        </ul>
      )}
      <CompletionDialog
        row={open}
        input={open ? inputOf(open, source) : "none"}
        saving={completion.pending}
        onClose={() => {
          setOpen(null)
        }}
        onSubmit={(values) => {
          const key = open
          if (!key) {
            return
          }
          completion.start(key, values).then(
            (job) => {
              setJobs((current) => ({ ...current, [key]: job.id }))
              setOpen(null)
            },
            (failure: unknown) => toast.error(errorText(t, failure))
          )
        }}
      />
    </SectionCard>
  )
}
