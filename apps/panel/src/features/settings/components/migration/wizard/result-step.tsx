import { Link } from "@tanstack/react-router"
import { ArrowRight, CircleCheck, Download, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { MigrationJob } from "@/features/settings/api/migration"
import { URL_EXPORT_PATH, runSummaryOf } from "@/features/settings/api/migration-overview"
import type { ProblemGroup } from "@/features/settings/api/migration-overview"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { CompletionDialog } from "@/features/settings/components/migration/completion-dialog"
import { inputOf } from "@/features/settings/components/migration/completion-rows"
import type { CompletionKey } from "@/features/settings/components/migration/completion-rows"
import { sourceKindOf } from "@/features/settings/components/migration/source-kind"
import { useStartCompletion } from "@/features/settings/components/migration/use-completion"
import { fixOf } from "@/features/settings/components/migration/wizard/kinds"
import { ProblemList } from "@/features/settings/components/migration/wizard/problem-list"
import { errorText } from "@/lib/errors"
import { formatCount, formatDateTime } from "@qticaret/admin-ui/lib/format"

const R = "settings.migration.wizard.result"
// The kinds a result shows as tiles, when something of them was added
const TILES = ["product", "image", "category", "post", "page", "customer", "order", "review"]

type ProductSource = "wordpress" | "shopify" | "feed"

interface ResultStepProps {
  job: MigrationJob
  /** The export the wizard holds: a retry does not ask for it again. */
  file: File | null
}

/**
 * Step 5 (adr/0042 Ek 2026-11-27): what was added by kind, then what needs
 * the owner, each reason once with its fix ("Yeniden dene" starts the
 * completion), the steps that come next, and the report and the 301 list.
 */
export function ResultStep({ job, file }: ResultStepProps) {
  const { t } = useTranslation()
  const summary = runSummaryOf(job)
  const input = (job.input ?? {}) as { source?: string }
  const kind = sourceKindOf(input.source ?? "bundle")
  const source: ProductSource | null =
    kind === "wordpress" || kind === "shopify" || kind === "feed" ? kind : null
  const completion = useStartCompletion(source)
  const [open, setOpen] = useState<CompletionKey | null>(null)
  const [retried, setRetried] = useState<Set<CompletionKey>>(new Set())
  if (!summary) {
    return null
  }
  const applied = summary.mode === "apply"
  const tiles = TILES.filter((each) => (summary.counts[each]?.["created"] ?? 0) > 0)
  const problems = summary.problems ?? []
  const action = (group: ProblemGroup) => {
    const fix = fixOf(group)
    if (fix === "products") {
      return (
        <Button asChild size="sm" variant="outline">
          <Link to="/products">
            {t(`${R}.openProducts`)}
            <ArrowRight />
          </Link>
        </Button>
      )
    }
    if (fix === "addresses") {
      return (
        <Button asChild size="sm" variant="outline">
          <Link to="/settings/migration/addresses">
            {t(`${R}.openAddresses`)}
            <ArrowRight />
          </Link>
        </Button>
      )
    }
    if (!fix || !applied || !source || retried.has(fix)) {
      return null
    }
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(fix)
        }}
      >
        <RotateCcw />
        {t(`${R}.retry`)}
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-4 shrink-0 text-success-text" aria-hidden="true" />
        {applied
          ? t(`${R}.finished`, { date: formatDateTime(job.finished_at ?? job.created_at) })
          : t(`${R}.previewed`)}
      </p>
      {tiles.length > 0 ? (
        <ul className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4 [&>li:last-child:nth-child(odd)]:col-span-2 md:[&>li:last-child:nth-child(odd)]:col-span-1">
          {tiles.map((each) => (
            <li
              key={each}
              className="flex h-full flex-col gap-0.5 rounded-lg border bg-card px-4 py-3 shadow-card"
            >
              <span className="text-xl font-semibold tabular-nums">
                {formatCount(summary.counts[each]?.["created"] ?? 0)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {t(`${R}.added`, { kind: t(`settings.migration.run.kinds.${each}`) })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          {t(`${R}.attention`)} {problems.length > 0 ? `(${formatCount(problems.length)})` : null}
        </h3>
        {problems.length > 0 ? (
          <ProblemList problems={problems} action={action} />
        ) : (
          <p className="text-[13px] text-muted-foreground">{t(`${R}.nothing`)}</p>
        )}
      </section>
      {applied ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t(`${R}.next`)}</h3>
          <ol className="grid items-stretch gap-3 md:grid-cols-3">
            {(
              [
                ["addresses", "/settings/migration/addresses"],
                ["domain", "/settings/migration"],
                ["invites", "/settings/migration"],
              ] as const
            ).map(([step, to], index) => (
              <li key={step} className="h-full">
                <Link
                  to={to}
                  className="flex h-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-card hover:bg-muted/50"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-medium">
                    {index + 1}
                  </span>
                  {t(`${R}.nextSteps.${step}`)}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <JobDownloadButton job={job} label={t(`${R}.report`)} />
        {applied ? (
          <Button asChild variant="outline">
            <a href={URL_EXPORT_PATH} download>
              <Download />
              {t(`${R}.csv`)}
            </a>
          </Button>
        ) : null}
      </div>
      <CompletionDialog
        row={open}
        input={open ? inputOf(open, source) : "none"}
        presetFile={file}
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
            () => {
              setRetried((current) => new Set([...current, key]))
              setOpen(null)
              toast.success(t(`${R}.retryStarted`))
            },
            (failure: unknown) => toast.error(errorText(t, failure))
          )
        }}
      />
    </div>
  )
}
