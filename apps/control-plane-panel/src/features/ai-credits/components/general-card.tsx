import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useSaveSettings } from "@/features/ai-credits/api/mutations"
import type { AiSettings } from "@/features/ai-credits/api/schemas"
import { isStepUpCancelled } from "@/lib/step-up"
import { DAILY_CAP_MAX } from "./daily-cap-dialog"
import { settingsErrorText, useSettingsDraft } from "./settings-draft"

const partOf = (settings: AiSettings) => ({
  daily_cap: settings.daily_cap,
  purchased_lifetime_months: settings.purchased_lifetime_months,
})

const toDraft = (part: ReturnType<typeof partOf>) => ({
  cap: String(part.daily_cap),
  months: String(part.purchased_lifetime_months),
})

// The control plane's bounds on the bought credits' life (months)
const LIFETIME_MIN = 1
const LIFETIME_MAX = 120

/**
 * Genel ayarlar (adr/0085 K6, K7): the platform's daily cap and the
 * bought credits' life in months, saved together behind a step-up.
 */
export function GeneralCard({ settings }: { settings: AiSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings()
  const { draft, setDraft, base, guard } = useSettingsDraft(settings, partOf, toDraft)
  const [failure, setFailure] = useState<string | null>(null)
  const capValue = parseCountInput(draft.cap)
  const monthsValue = parseCountInput(draft.months)
  const valid =
    capValue !== null &&
    capValue <= DAILY_CAP_MAX &&
    monthsValue !== null &&
    monthsValue >= LIFETIME_MIN &&
    monthsValue <= LIFETIME_MAX
  const dirty = capValue !== base.daily_cap || monthsValue !== base.purchased_lifetime_months
  const submit = () => {
    if (!valid) {
      return
    }
    setFailure(null)
    save.mutate(
      (current) => {
        guard(current)
        return { daily_cap: capValue, purchased_lifetime_months: monthsValue }
      },
      {
        onSuccess: () => {
          toast.success(t("aiCredits.general.done"))
        },
        onError: (error) => {
          if (!isStepUpCancelled(error)) {
            setFailure(settingsErrorText(t, error))
          }
        },
      }
    )
  }
  return (
    <SectionCard
      title={t("aiCredits.general.title")}
      description={t("aiCredits.general.text")}
      action={
        <Button disabled={!dirty || !valid || save.isPending} onClick={submit}>
          {t("common.save")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-daily-cap">{t("aiCredits.general.dailyCap")}</Label>
          <NumberField
            id="ai-daily-cap"
            min={0}
            max={DAILY_CAP_MAX}
            suffix={t("aiCredits.unit")}
            value={draft.cap}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, cap: event.target.value }))
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("aiCredits.general.dailyCapHelp")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-lifetime">{t("aiCredits.general.lifetime")}</Label>
          <NumberField
            id="ai-lifetime"
            min={LIFETIME_MIN}
            max={LIFETIME_MAX}
            suffix={t("aiCredits.general.months")}
            value={draft.months}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, months: event.target.value }))
            }}
          />
          <p className="text-[13px] text-muted-foreground">{t("aiCredits.general.lifetimeHelp")}</p>
        </div>
      </div>
      {failure ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {failure}
        </p>
      ) : null}
    </SectionCard>
  )
}
