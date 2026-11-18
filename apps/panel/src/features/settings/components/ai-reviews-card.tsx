import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { AI_KEY } from "@/features/ai/api/ai"
import { useCan } from "@/features/auth/api/staff"
import { useFeatureState, useSetFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"

/** The shop's own flag for AI on customers' words (adr/0071 §6, §10; backend `AI_REVIEWS`). */
export const AI_REVIEWS_FLAG = "ai.reviews"

const R = "ai.reviews"

/**
 * Settings › Yapay zekâ: AI on reviews and questions, off until the shop
 * turns it on (Aşama 9). What customers wrote goes to the service, so the
 * (i) says what goes and what is taken out. The owner and an admin switch
 * it; others see its state. On or off, the review screens' buttons follow.
 */
export function AiReviewsCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const enabled = useFeatureState(AI_REVIEWS_FLAG)
  const mayChange = useCan("settings")
  const toggle = useSetFeature()
  return (
    <SectionCard
      title={t(`${R}.settingTitle`)}
      description={t(`${R}.settingDescription`)}
      action={
        <span className="flex items-center gap-2">
          <InfoTip name={t(`${R}.settingTitle`)} hint={t(`${R}.settingDetail`)} />
          <Switch
            aria-label={t(`${R}.settingTitle`)}
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
        </span>
      }
    >
      <p className="text-[13px] text-muted-foreground">{t(`${R}.note`)}</p>
    </SectionCard>
  )
}
