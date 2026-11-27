import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { ProblemGroup } from "@/features/settings/api/migration-overview"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const K = "settings.migration.wizard.kinds"
// The groups a glance takes in; the report has every row
const SHOWN = 10

interface ProblemListProps {
  problems: readonly ProblemGroup[]
  /** A group's fix (a completion, a page), when it has one. */
  action?: (group: ProblemGroup) => ReactNode
}

/**
 * A run's problems by reason (adr/0042 Ek 2026-11-27): each reason once,
 * in the server's words, with how many and its fix; "Hangileri?" opens a
 * few of the records (never a person's: the server keeps none).
 */
export function ProblemList({ problems, action }: ProblemListProps) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col divide-y rounded-md border" data-testid="migration-problems">
      {problems.slice(0, SHOWN).map((group) => (
        <li
          key={`${group.kind} ${group.key}`}
          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm">
              <span className="font-medium tabular-nums">{formatCount(group.count)}</span>{" "}
              {t(`settings.migration.run.kinds.${group.kind}`, { defaultValue: group.kind })}
              {" — "}
              {group.message ?? group.key}
            </p>
            {group.samples.length > 0 ? (
              <details className="group/samples text-[13px] text-muted-foreground">
                <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                  {t("settings.migration.wizard.result.list")}
                  <ChevronDown
                    className="size-3.5 transition-transform group-open/samples:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <ul className="mt-1 flex flex-col gap-0.5 break-all">
                  {group.samples.map((sample) => (
                    <li key={sample}>{sample}</li>
                  ))}
                  {group.count > group.samples.length ? <li>{t(`${K}.moreInReport`)}</li> : null}
                </ul>
              </details>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap gap-2">{action(group)}</div> : null}
        </li>
      ))}
    </ul>
  )
}
