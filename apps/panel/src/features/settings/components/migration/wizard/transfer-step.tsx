import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CircleCheck, Circle, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type { MigrationJob } from "@/features/settings/api/migration"
import { phaseOf, runOfJobQuery } from "@/features/settings/api/migration-overview"
import type { RunKindName } from "@/features/settings/api/migration-overview"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const T = "settings.migration.wizard.transfer"

type KindState = "waiting" | "doing" | "done"

interface TransferStepProps {
  job: MigrationJob | undefined
  /** The kinds asked, until the run names the ones it takes (with what they need). */
  kinds: readonly RunKindName[]
}

/**
 * Step 4: the transfer as it goes, kind by kind (adr/0042 Ek 2026-11-27):
 * each done with its count, the one under way with how many of how many
 * (612 / 1002 pictures), the rest waiting. The run keeps going if the
 * owner leaves the page.
 */
export function TransferStep({ job, kinds }: TransferStepProps) {
  const { t } = useTranslation()
  const running = job?.status === "queued" || job?.status === "running"
  const run = useQuery(runOfJobQuery(job?.id ?? null, running))
  const phase = phaseOf(run.data)
  const taken = (phase?.kinds ?? kinds) as RunKindName[]
  const finished = job?.status === "succeeded"
  const stateOf = (kind: RunKindName): KindState => {
    if (finished) {
      return "done"
    }
    if (phase?.kind === kind) {
      return phase.done >= phase.total && kind !== "url" ? "done" : "doing"
    }
    const at = phase ? taken.indexOf(phase.kind as RunKindName) : -1
    return at > taken.indexOf(kind) ? "done" : "waiting"
  }
  if (job && !running && !finished) {
    return (
      <p
        className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t(`${T}.failed`, { reason: job.error_message ?? "" })}
      </p>
    )
  }
  return (
    <ul
      className="flex max-w-3xl flex-col divide-y rounded-lg border bg-card shadow-card"
      data-testid="migration-transfer"
    >
      {taken.map((kind) => {
        const state = stateOf(kind)
        const counts = run.data?.counts[kind]
        const Icon = state === "done" ? CircleCheck : state === "doing" ? Loader2 : Circle
        return (
          <li key={kind} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    state === "done" && "text-success-text",
                    state === "doing" && "animate-spin text-primary",
                    state === "waiting" && "text-muted-foreground"
                  )}
                />
                {kind === "url"
                  ? t("settings.migration.wizard.kinds.url")
                  : t(`settings.migration.run.kinds.${kind}`)}
              </span>
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {state === "doing" && phase && phase.total > 0
                  ? t(`${T}.progress`, {
                      done: formatCount(phase.done),
                      total: formatCount(phase.total),
                    })
                  : state === "done" && counts
                    ? t(`${T}.progress`, {
                        done: formatCount(counts.created + counts.found),
                        total: formatCount(counts.read),
                      })
                    : state === "done"
                      ? t(`${T}.finished`)
                      : t(`${T}.waiting`)}
              </span>
            </div>
            {state === "doing" && phase && phase.total > 0 ? (
              <Progress
                value={Math.round((phase.done / phase.total) * 100)}
                aria-label={t(`settings.migration.run.kinds.${kind}`, { defaultValue: kind })}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
