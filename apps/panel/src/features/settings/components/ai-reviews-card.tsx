import { useQueryClient } from "@tanstack/react-query"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { AI_KEY } from "@/features/ai/api/ai"
import { useStaff } from "@/features/auth/api/staff"
import { useFeatureState, useSetFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"

/** The shop's own flag for AI on customers' words (adr/0071 §6, §10; backend `AI_REVIEWS`). */
export const AI_REVIEWS_FLAG = "ai.reviews"

const R = "ai.reviews"

/**
 * Settings › Yapay zekâ: AI on reviews and questions in one line, off
 * until the shop turns it on (Aşama 9). What customers wrote goes to the
 * service, so the (i) says what it does, what goes and what is taken out.
 * Only the owner switches it, as with the service's connection (backend
 * `OWNER_ONLY`); others see its state and why. On or off, the review
 * screens' buttons follow.
 */
export function AiReviewsCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const enabled = useFeatureState(AI_REVIEWS_FLAG)
  const mayChange = useStaff()?.role === "owner"
  const toggle = useSetFeature()
  const hintId = useId()
  const title = t(`${R}.settingTitle`)
  return (
    <section className="flex min-h-14 items-center gap-4 rounded-lg border bg-card px-5 py-3 text-card-foreground shadow-card">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="flex items-center gap-1.5 text-[15px] leading-6 font-semibold">
          {title}
          <InfoTip
            name={title}
            hintId={hintId}
            hint={
              <span className="flex flex-col gap-1.5">
                <span>{t(`${R}.settingDescription`)}</span>
                <span>{t(`${R}.settingDetail`)}</span>
              </span>
            }
          />
        </h2>
        <HiddenHint id={hintId}>
          {t(`${R}.settingDescription`)} {t(`${R}.settingDetail`)}
        </HiddenHint>
        {mayChange ? null : (
          <p className="text-[13px] leading-5 text-muted-foreground">{t(`${R}.ownerOnly`)}</p>
        )}
      </div>
      <Switch
        aria-label={title}
        aria-describedby={hintId}
        checked={enabled === true}
        disabled={enabled === undefined || !mayChange || toggle.isPending}
        onCheckedChange={(next) => {
          toggle.mutate(
            { key: AI_REVIEWS_FLAG, enabled: next },
            {
              onSuccess: () => {
                toast.success(t("settings.saved"))
                // The tasks' `allowed` follows the flag: the buttons come or go
                void client.invalidateQueries({ queryKey: AI_KEY })
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      />
    </section>
  )
}
