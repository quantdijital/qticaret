import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { migrationRunsQuery } from "@/features/settings/api/migration"
import type { MigrationRun } from "@/features/settings/api/migration"
import { formatCount, formatDateTime } from "@/lib/format"

const R = "settings.migration.runs"
const TONES: Readonly<Record<MigrationRun["status"], StatusTone>> = {
  running: "info",
  done: "success",
  failed: "danger",
}
// "shopify:magaza.myshopify.com" as the panel names its source
const SOURCE_KINDS = ["shopify", "feed", "customers", "bundle"] as const
const sourceOf = (source: string) =>
  SOURCE_KINDS.find((kind) => source === kind || source.startsWith(`${kind}:`)) ?? "bundle"

// The runs a glance takes in; older ones are on the jobs page
const SHOWN = 5

/** The latest runs, newest first: their source, mode, state and what moved. */
export function RecentRuns() {
  const { t } = useTranslation()
  const runs = useQuery(migrationRunsQuery())
  return (
    <section className="flex flex-col gap-2" aria-labelledby="migration-runs">
      <h3 id="migration-runs" className="text-sm font-medium">
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
                  {t(`settings.migration.run.sources.${sourceOf(run.source)}`)} ·{" "}
                  {t(`${R}.modes.${run.mode}`)}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {formatDateTime(run.created_at)} ·{" "}
                  {t(`${R}.summary`, {
                    products: formatCount(run.counts["product"]?.read ?? 0),
                    customers: formatCount(run.counts["customer"]?.read ?? 0),
                  })}
                </p>
              </div>
              <StatusBadge tone={TONES[run.status]}>{t(`${R}.statuses.${run.status}`)}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
