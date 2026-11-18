import { AlertTriangle, CircleCheck, Loader2, Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { aiFailureText } from "@/features/ai/failure-text"
import type { AltJobSummary } from "@/features/media/api/alt-review"
import type { SheetJob } from "@/features/products/api/sheets"

export interface AltReviewStartProps {
  /** The services the backend says can do the task. */
  usable: readonly string[]
  service: string
  onService: (service: string) => void
  /** The job this dialog started, while it runs and once it ended. */
  job: SheetJob | undefined
  starting: boolean
  onStart: () => void
}

const R = "ai.altReview"

const isRunning = (job: SheetJob | undefined) =>
  job?.status === "queued" || job?.status === "running"

/** What the job did, once it ended: suggestions made, images left, and why it stopped. */
function JobOutcome({ job }: { job: SheetJob }) {
  const { t } = useTranslation()
  const summary = job.result_summary as unknown as AltJobSummary | null
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
 * The top of the review dialog: which service (only when several can), the
 * one button that asks for the library's images with no alt text, and the
 * job's progress then its outcome. No service: the connect tip instead.
 */
export function AltReviewStart({
  usable,
  service,
  onService,
  job,
  starting,
  onStart,
}: AltReviewStartProps) {
  const { t } = useTranslation()
  const [hintGone, setHintGone] = useState(false)
  if (usable.length === 0) {
    // Here the tip is the whole reason nothing can start: it shows even once closed on the fields
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
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{t("ai.suggest.imageNote")}</p>
      <AiServicePicker
        services={usable}
        value={service}
        disabled={running || starting}
        onChange={onService}
      />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={running || starting}
        onClick={onStart}
      >
        {starting ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {t(`${R}.start`)}
      </Button>
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
