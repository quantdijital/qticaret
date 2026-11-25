import { AlertTriangle, CircleCheck, Loader2, Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiCreditCost } from "@/features/ai/components/ai-credit-cost"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { aiFailureText } from "@/features/ai/failure-text"
import { SEO_FILL_SCOPES, scopeTotal } from "@/features/seo/api/seo-fill"
import type {
  SeoFillCount,
  SeoFillScope,
  SeoFillSummary,
  SeoFillTask,
} from "@/features/seo/api/seo-fill"
import type { SheetJob } from "@/features/products/api/sheets"

export interface SeoFillStartProps {
  usable: readonly string[]
  service: string
  onService: (service: string) => void
  scope: SeoFillScope
  onScope: (scope: SeoFillScope) => void
  count: SeoFillCount | undefined
  job: SheetJob | undefined
  starting: boolean
  onStart: () => void
}

const R = "seo.aiFill"

/** The texts one page may be asked for, by what is filled (a page asks only for those it lacks). */
const SCOPE_TASKS: Readonly<Record<SeoFillScope, readonly SeoFillTask[]>> = {
  both: ["seo_title", "seo_description"],
  title: ["seo_title"],
  description: ["seo_description"],
}

const isRunning = (job: SheetJob | undefined) =>
  job?.status === "queued" || job?.status === "running"

function JobOutcome({ job }: { job: SheetJob }) {
  const { t } = useTranslation()
  const summary = job.result_summary as unknown as SeoFillSummary | null
  if (job.status !== "succeeded" || !summary) {
    return (
      <p className="flex items-start gap-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {job.error_message ?? t(`${R}.jobFailed`)}
      </p>
    )
  }
  const left = summary.refused + summary.failed + summary.not_asked
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex items-start gap-2 font-medium">
        <CircleCheck className="h-lh w-4 shrink-0 text-success-text" aria-hidden="true" />
        {t(`${R}.made`, { count: summary.suggested })}
      </p>
      {left > 0 ? <p className="text-muted-foreground">{t(`${R}.left`, { count: left })}</p> : null}
      {summary.stopped ? (
        <p className="flex items-start gap-2 text-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {aiFailureText(t, { code: summary.stopped }, null)}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The top of the review dialog: one button that asks for the pages the
 * advisor flags (both texts), what to fill and which service behind
 * "Seçenekler", then the job's progress and outcome. No service: the
 * connect tip instead.
 */
export function SeoFillStart({
  usable,
  service,
  onService,
  scope,
  onScope,
  count,
  job,
  starting,
  onStart,
}: SeoFillStartProps) {
  const { t } = useTranslation()
  const [hintGone, setHintGone] = useState(false)
  if (usable.length === 0) {
    // Here the tip is the whole reason nothing can start
    return hintGone ? null : (
      <div className="rounded-md border bg-muted/40 px-3 py-2.5">
        <AiConnectHint
          onClose={() => {
            setHintGone(true)
          }}
        />
      </div>
    )
  }
  const running = isRunning(job)
  const total = scopeTotal(count, scope)
  const pages = count ? Math.min(total, count.max) : 0
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <Button
        type="button"
        className="self-start"
        disabled={running || starting || pages === 0}
        onClick={onStart}
      >
        {starting ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {t(`${R}.start`, { count: pages })}
      </Button>
      <p className="text-xs text-muted-foreground">
        {total > pages
          ? t(`${R}.batch`, {
              count: pages,
              total: count?.capped ? `${String(total)}+` : String(total),
            })
          : t(`${R}.cost`, { count: pages })}
      </p>
      <AiCreditCost tasks={SCOPE_TASKS[scope]} service={service} items={pages} />
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          {t(`${R}.options`)}
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium">{t(`${R}.scopeLabel`)}</legend>
            {SEO_FILL_SCOPES.map((each) => (
              <label key={each} className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio"
                  name="seo-fill-scope"
                  value={each}
                  checked={scope === each}
                  disabled={running || starting}
                  onChange={() => {
                    onScope(each)
                  }}
                />
                {t(`${R}.scopes.${each}`)}
              </label>
            ))}
          </fieldset>
          <AiServicePicker
            services={usable}
            value={service}
            disabled={running || starting}
            onChange={onService}
          />
        </div>
      </details>
      <div aria-live="polite">
        {running ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t(`${R}.working`)}
            </p>
            <Progress value={job?.progress ?? 0} aria-label={t(`${R}.working`)} />
          </div>
        ) : job ? (
          <JobOutcome job={job} />
        ) : null}
      </div>
    </div>
  )
}
