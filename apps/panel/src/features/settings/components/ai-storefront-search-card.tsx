import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useStaff } from "@/features/auth/api/staff"
import { useFeatureState, useSetFeature } from "@/features/settings/api/features"
import {
  AI_STOREFRONT_SEARCH_FLAG,
  AiStorefrontSearchConfirm,
} from "@/features/settings/components/ai-storefront-search-confirm"
import { errorText } from "@/lib/errors"

const S = "ai.storefrontSearch"

/**
 * Settings › Yapay zekâ: search in the shopper's own words in one line,
 * off until the shop turns it on. Turning it on asks first (what goes to
 * the service, what may not be taken out, the privacy notice). Without
 * the shop's own text key it cannot go on, and says why; once on, it can
 * always go off. Only the owner switches it (backend `OWNER_ONLY`).
 */
export function AiStorefrontSearchCard({ ownKey }: { ownKey: boolean }) {
  const { t } = useTranslation()
  const enabled = useFeatureState(AI_STOREFRONT_SEARCH_FLAG)
  const mayChange = useStaff()?.role === "owner"
  const toggle = useSetFeature()
  const [asking, setAsking] = useState(false)
  const hintId = useId()
  const title = t(`${S}.settingTitle`)
  const save = (next: boolean) => {
    toggle.mutate(
      { key: AI_STOREFRONT_SEARCH_FLAG, enabled: next },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const blocked = enabled !== true && !ownKey
  const note = !mayChange ? t(`${S}.ownerOnly`) : blocked ? t(`${S}.needsOwnKey`) : null
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
                <span>{t(`${S}.settingDescription`)}</span>
                <span>{t(`${S}.settingDetail`)}</span>
              </span>
            }
          />
        </h2>
        <HiddenHint id={hintId}>
          {t(`${S}.settingDescription`)} {t(`${S}.settingDetail`)}
        </HiddenHint>
        {note ? <p className="text-[13px] leading-5 text-muted-foreground">{note}</p> : null}
      </div>
      <Switch
        aria-label={title}
        aria-describedby={hintId}
        checked={enabled === true}
        disabled={enabled === undefined || !mayChange || blocked || toggle.isPending}
        onCheckedChange={(next) => {
          if (next) {
            setAsking(true)
            return
          }
          save(false)
        }}
      />
      {asking ? (
        <AiStorefrontSearchConfirm
          onConfirm={() => {
            setAsking(false)
            save(true)
          }}
          onCancel={() => {
            setAsking(false)
          }}
        />
      ) : null}
    </section>
  )
}
