import { AlertTriangle, Info, Loader2, Lock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type { MigrationJob } from "@/features/settings/api/migration"
import { NOT_MOVED_KINDS, wordpressReportOf } from "@/features/settings/api/migration-wordpress"
import { neededBy, runSummaryOf } from "@/features/settings/api/migration-overview"
import type { RunKindName } from "@/features/settings/api/migration-overview"
import { kindsFound, withoutKind } from "@/features/settings/components/migration/wizard/kinds"
import { ProblemList } from "@/features/settings/components/migration/wizard/problem-list"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const K = "settings.migration.wizard.kinds"
const KINDS = "settings.migration.run.kinds"

interface KindsStepProps {
  job: MigrationJob | undefined
  chosen: ReadonlySet<RunKindName>
  onChange: (chosen: Set<RunKindName>) => void
}

/**
 * Step 3: the preview is the step (adr/0042 Ek 2026-11-27): what the file
 * holds, by kind, with what would be added, what is here already and what
 * would not move; a box per kind, what a ticked kind needs locked on.
 * What does not move at all (coupons, menus) is said once, below.
 */
export function KindsStep({ job, chosen, onChange }: KindsStepProps) {
  const { t } = useTranslation()
  if (!job || job.status === "queued" || job.status === "running") {
    const progress = Math.round(job?.progress ?? 0)
    return (
      <div className="flex max-w-3xl flex-col gap-2 rounded-lg border bg-card px-5 py-5 shadow-card">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("settings.migration.wizard.reading")}
        </p>
        <Progress value={progress} aria-label={t("settings.migration.wizard.reading")} />
      </div>
    )
  }
  const summary = runSummaryOf(job)
  if (!summary) {
    return (
      <p
        className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("settings.migration.wizard.previewFailed", { reason: job.error_message ?? "" })}
      </p>
    )
  }
  const found = kindsFound(job)
  const locked = neededBy(chosen)
  const report = wordpressReportOf(job.result_summary)
  const notMoved = NOT_MOVED_KINDS.filter((kind) => (report.not_moved?.[kind] ?? 0) > 0)
  const attributes = report.attributes ?? []
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">{t("settings.migration.overview.rule")}</p>
      <ul
        className="flex flex-col divide-y rounded-lg border bg-card shadow-card"
        data-testid="migration-kinds"
      >
        {found.map((kind) => {
          const own = summary.counts[kind] ?? {}
          const lockedBy = locked.get(kind)
          const checked = chosen.has(kind) || lockedBy !== undefined
          const problems = (own["skipped"] ?? 0) + (own["failed"] ?? 0)
          const id = `wizard-kind-${kind}`
          return (
            <li key={kind} className="flex items-start gap-3 px-4 py-3">
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={checked}
                disabled={lockedBy !== undefined}
                onCheckedChange={(next) => {
                  onChange(next === true ? new Set([...chosen, kind]) : withoutKind(chosen, kind))
                }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
                  {kind === "url" ? t(`${K}.url`) : t(`${KINDS}.${kind}`)}
                  {lockedBy ? (
                    <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  ) : null}
                </label>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {kind === "url"
                    ? t(`${K}.urlText`)
                    : lockedBy
                      ? t(`${K}.required`, { kind: t(`${KINDS}.${lockedBy}`) })
                      : [
                          t(`${K}.read`, { count: own["read"] ?? 0 }),
                          t(`${K}.created`, { count: own["created"] ?? 0 }),
                          ...((own["found"] ?? 0) > 0
                            ? [t(`${K}.found`, { count: own["found"] ?? 0 })]
                            : []),
                          ...(problems > 0 ? [t(`${K}.problems`, { count: problems })] : []),
                        ].join(" · ")}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {summary.problems && summary.problems.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t(`${K}.problemsTitle`)}</h3>
          <ProblemList problems={summary.problems} />
        </section>
      ) : null}
      {attributes.length > 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`${K}.attributes`, {
            count: attributes.length,
            names: attributes
              .slice(0, 3)
              .map((each) => each.name)
              .join(", "),
          })}
        </p>
      ) : null}
      {notMoved.length > 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">{t(`${K}.notMoved`)}:</span>{" "}
            {notMoved
              .map(
                (kind) =>
                  `${formatCount(report.not_moved?.[kind] ?? 0)} ${t(`settings.migration.wordpress.report.kinds.${kind}`)} (${t(`settings.migration.wordpress.report.why.${kind}`)})`
              )
              .join(" · ")}
          </span>
        </p>
      ) : null}
    </div>
  )
}
