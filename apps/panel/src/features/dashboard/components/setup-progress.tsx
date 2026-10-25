import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { setupFactsQuery } from "@/features/dashboard/api/setup"
import { setupStatus } from "@/features/dashboard/setup-steps"
import type { SetupStatus } from "@/features/dashboard/setup-steps"
import { advancedPanelUrl } from "@/lib/advanced-panel"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"

/** "Get your shop ready": numbered steps, the first open one marked as next. */
export function SetupProgress() {
  const { t } = useTranslation()
  const { data, isPending, isError, error, refetch } = useQuery(setupFactsQuery())
  const status = data ? setupStatus(data) : null

  if (status?.nextKey === null) {
    return null
  }
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-col gap-1 border-b px-5 py-4">
        <h2 className="text-base font-semibold">{t("dashboard.setup.title")}</h2>
        {status ? (
          <p className="text-sm text-muted-foreground">
            {t("dashboard.setup.progress", { done: status.doneCount, total: status.steps.length })}
          </p>
        ) : null}
      </div>
      <div className="px-5 py-4">
        {isPending ? (
          <LoadingRows rows={4} />
        ) : isError || !status ? (
          <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
        ) : (
          <Steps status={status} />
        )}
      </div>
    </section>
  )
}

function Steps({ status }: { status: SetupStatus }) {
  const { t } = useTranslation()
  return (
    <ol className="flex flex-col">
      {status.steps.map(({ step, isDone }, index) => {
        const isNext = step.key === status.nextKey
        return (
          <li
            key={step.key}
            className="flex items-start gap-4 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                isDone && "border-success bg-success text-success-foreground",
                isNext && "border-primary text-primary"
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  "text-sm font-medium",
                  isDone && "text-muted-foreground line-through"
                )}
              >
                {t(`dashboard.setup.steps.${step.key}.title`)}
              </span>
              <span className="text-sm text-muted-foreground">
                {t(`dashboard.setup.steps.${step.key}.description`)}
              </span>
            </div>
            {!isDone ? (
              <Button
                asChild
                size="sm"
                variant={isNext ? "default" : "outline"}
                className="shrink-0"
              >
                <a href={advancedPanelUrl(step.advancedPath)} target="_blank" rel="noreferrer">
                  {t("dashboard.setup.openInAdvanced")}
                </a>
              </Button>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
