import { useQuery } from "@tanstack/react-query"
import { Loader2, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { migrationRunsQuery, useRestartMigration } from "@/features/settings/api/migration"
import type { MigrationJob, MigrationRun } from "@/features/settings/api/migration"
import { sourceKindOf } from "@/features/settings/components/migration/source-kind"
import { errorText } from "@/lib/errors"
import { formatCount, formatDateTime } from "@qticaret/admin-ui/lib/format"

const R = "settings.migration.runs"
const TONES: Readonly<Record<MigrationRun["status"], StatusTone>> = {
  running: "info",
  done: "success",
  failed: "danger",
}

// Its worker stopped half-way (a crash, a restart): started again from its file, or already
const halfWay = (run: MigrationRun) =>
  run.status === "failed" && (run.error_code === "interrupted" || run.error_code === "restarted")

// The runs a glance takes in; older ones are on the jobs page
const SHOWN = 5

interface RecentRunsProps {
  /** A run started again: its job, for the card to follow. */
  onStarted?: (job: MigrationJob) => void
  /** Another run is under way: nothing starts beside it. */
  busy?: boolean
  /** The page names the list itself (a folded "Geçmiş aktarımlar"). */
  hideTitle?: boolean
}

/**
 * The latest runs, newest first: their source, mode, state and what moved.
 * One its worker left half-way says so and can be started again from its
 * stored file (or, when that is gone, says to upload it again).
 */
export function RecentRuns({ onStarted, busy = false, hideTitle = false }: RecentRunsProps) {
  const { t } = useTranslation()
  const runs = useQuery(migrationRunsQuery())
  const restart = useRestartMigration()
  const again = (run: MigrationRun) => {
    restart.mutate(run.id, {
      onSuccess: (job) => {
        toast.success(t(`${R}.restarted`))
        onStarted?.(job)
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <section className="flex flex-col gap-2" aria-labelledby="migration-runs">
      <h3 id="migration-runs" className={hideTitle ? "sr-only" : "text-sm font-medium"}>
        {t(`${R}.title`)}
      </h3>
      {!runs.data ? (
        <Skeleton className="h-24 rounded-md" />
      ) : runs.data.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-[13px] text-muted-foreground">
          {t(`${R}.empty`)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {runs.data.slice(0, SHOWN).map((run) => (
            <li
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-medium">
                  {t(`settings.migration.run.sources.${sourceKindOf(run.source)}`)} ·{" "}
                  {t(`${R}.modes.${run.mode}`)}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {formatDateTime(run.created_at)} ·{" "}
                  {t(`${R}.summary`, {
                    products: formatCount(run.counts["product"]?.read ?? 0),
                    customers: formatCount(run.counts["customer"]?.read ?? 0),
                  })}
                  {run.error_code === "restarted" ? ` · ${t(`${R}.restartedNote`)}` : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {run.error_code === "interrupted" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || restart.isPending}
                    onClick={() => {
                      again(run)
                    }}
                  >
                    {restart.isPending && restart.variables === run.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RotateCcw />
                    )}
                    {t(`${R}.restart`)}
                  </Button>
                ) : null}
                <StatusBadge tone={halfWay(run) ? "warning" : TONES[run.status]}>
                  {t(halfWay(run) ? `${R}.statuses.interrupted` : `${R}.statuses.${run.status}`)}
                </StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
