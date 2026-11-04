import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { Switch } from "@/components/ui/switch"
import { ORIGINALITY, useUpdateLanding } from "@/features/content/api/landings"
import type { LandingDetail } from "@/features/content/api/landings"
import { OriginalityBadge } from "@/features/content/components/originality-badge"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * What decides whether a landing page may stand (docs/14 §3.7): how much of
 * its text is its own, how many products it lists, and whether a person
 * read it through.
 */
export function LandingStandingCard({ landing }: { landing: LandingDetail }) {
  const { t } = useTranslation()
  const update = useUpdateLanding(landing.id)
  const value = landing.originality
  const bar =
    value < ORIGINALITY.low
      ? "bg-destructive"
      : value < ORIGINALITY.warn
        ? "bg-warning"
        : "bg-success"
  return (
    <SectionCard
      title={t("content.landing.standing")}
      description={t("content.landing.standingHint")}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{t("content.landing.originality")}</span>
            <OriginalityBadge value={value} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={cn("h-full rounded-full", bar)}
              style={{ width: `${String(value)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("content.landing.originalityHint", ORIGINALITY)}
          </p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("content.landing.products")}</span>
          <span className="tabular-nums">{formatCount(landing.product_count)}</span>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <Switch
            checked={landing.reviewed_at !== null}
            disabled={update.isPending}
            className="mt-0.5"
            onCheckedChange={(reviewed) => {
              update.mutate(
                { reviewed },
                { onError: (failure) => toast.error(errorText(t, failure)) }
              )
            }}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("content.landing.reviewed")}</span>
            <span className="text-[13px] text-muted-foreground">
              {t("content.landing.reviewedHint")}
            </span>
          </span>
        </label>
      </div>
    </SectionCard>
  )
}
