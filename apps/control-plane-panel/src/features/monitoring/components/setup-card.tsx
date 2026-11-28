import { CircleCheck, Circle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { formatDateTime, formatRelative } from "@qticaret/admin-ui/lib/format"
import type { UsageHealth } from "../api"
import { setupProgress } from "../setup-rules"

/**
 * "Kurulum durumu" (adr/0061 Ek C21): the shop's own setup checklist as its
 * last hourly report said it, a green check per step done, a grey circle
 * per step open, and when that report came. Yes/no only: what is behind a
 * step (which provider, which account) stays in the shop. No report yet,
 * or a shop on an older release: one sentence saying so.
 */
export function SetupCard({ data }: { data: UsageHealth }) {
  const { t } = useTranslation()
  const usage = data.usage
  const progress = setupProgress(usage?.setup)
  const badge = progress ? (
    <StatusBadge tone={progress.complete ? "success" : "neutral"}>
      {progress.complete
        ? t("setupStatus.complete")
        : t("setupStatus.count", { done: progress.done, total: progress.total })}
    </StatusBadge>
  ) : null
  return (
    <SectionCard
      title={t("setupStatus.title")}
      description={
        progress
          ? t("setupStatus.text")
          : usage
            ? t("setupStatus.olderShop")
            : t("setupStatus.noReport")
      }
      action={badge}
    >
      {progress && usage ? (
        <div className="flex flex-col gap-4">
          <Progress
            value={Math.round((progress.done / progress.total) * 100)}
            aria-label={t("setupStatus.count", { done: progress.done, total: progress.total })}
            className="h-1.5"
          />
          <ul
            aria-label={t("setupStatus.listLabel")}
            className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {progress.steps.map((step) => {
              const Icon = step.done ? CircleCheck : Circle
              return (
                <li key={step.key} className="flex min-w-0 items-center gap-2 text-sm">
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0",
                      step.done ? "text-success" : "text-muted-foreground/60"
                    )}
                  />
                  <span className={cn("truncate", step.done ? "" : "text-muted-foreground")}>
                    {t(`setupStatus.steps.${step.key}`)}
                  </span>
                  <span className="sr-only">
                    {step.done ? t("setupStatus.done") : t("setupStatus.open")}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="border-t pt-3 text-sm text-muted-foreground">
            {t("setupStatus.reportedAt", {
              relative: formatRelative(usage.received_at),
              date: formatDateTime(usage.received_at),
            })}
          </p>
        </div>
      ) : null}
    </SectionCard>
  )
}
