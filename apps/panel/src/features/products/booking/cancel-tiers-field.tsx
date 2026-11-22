import { useQuery } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useWatch } from "react-hook-form"
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { sectionQuery } from "@/features/settings/api/sections"
import type { ReturnsSettings } from "@/features/settings/api/sections"
import { PACKAGE_TRAVEL_FREE_DAYS, TIER_LIMITS, nextTier } from "./cancel-tiers"
import type { SettingsDraft } from "./slot-schemas"

const B = "products.booking.settings.tiers"

/**
 * The customer's own cancellation (adr/0076 §8, D7a): "N days or more
 * before, X% kept". None: the customer cannot cancel (staff always can).
 * Under package travel, 30 days or more refunds in full whatever is set.
 */
export function CancelTiersField({
  control,
  register,
  errors,
}: {
  control: Control<SettingsDraft>
  register: UseFormRegister<SettingsDraft>
  errors: FieldErrors<SettingsDraft>["tiers"]
}) {
  const { t } = useTranslation()
  const tiers = useFieldArray({ control, name: "tiers" })
  const rows = useWatch({ control, name: "tiers" })
  const returns = useQuery(sectionQuery<ReturnsSettings>("returns"))
  const packageTravel = returns.data?.values.package_travel === true
  const listError = errors?.root?.message ?? errors?.message
  return (
    <fieldset className="flex flex-col gap-3 border-t pt-4">
      <legend className="text-sm font-medium">{t(`${B}.title`)}</legend>
      <p className="text-[13px] text-muted-foreground">
        {t(tiers.fields.length === 0 ? `${B}.empty` : `${B}.hint`)}
      </p>
      {tiers.fields.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {tiers.fields.map((field, index) => {
            const number = index + 1
            const entry = errors?.[index]
            const message = entry?.days_before?.message ?? entry?.fee_percent?.message
            const days = Number(rows[index]?.days_before ?? "")
            const free = packageTravel && days >= PACKAGE_TRAVEL_FREE_DAYS
            return (
              <li key={field.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <NumberField
                    className="w-24"
                    min={0}
                    max={TIER_LIMITS.days}
                    suffix={t(`${B}.days`)}
                    aria-label={t(`${B}.daysOf`, { number })}
                    aria-invalid={Boolean(entry?.days_before)}
                    {...register(`tiers.${index}.days_before`)}
                  />
                  <span>{t(`${B}.orMore`)}</span>
                  <NumberField
                    className="w-24"
                    min={0}
                    max={TIER_LIMITS.percent}
                    suffix="%"
                    aria-label={t(`${B}.percentOf`, { number })}
                    aria-invalid={Boolean(entry?.fee_percent)}
                    {...register(`tiers.${index}.fee_percent`)}
                  />
                  <span>{t(`${B}.kept`)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t(`${B}.remove`, { number })}
                    onClick={() => {
                      tiers.remove(index)
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                {free ? (
                  <p className="text-xs text-muted-foreground">{t(`${B}.packageFree`)}</p>
                ) : null}
                {message ? (
                  <p role="alert" className="text-xs text-destructive-text">
                    {t(message)}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}
      {listError ? (
        <p role="alert" className="text-xs text-destructive-text">
          {t(listError)}
        </p>
      ) : null}
      {tiers.fields.length < TIER_LIMITS.rows ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            tiers.append(nextTier(rows))
          }}
        >
          <Plus aria-hidden />
          {t(`${B}.add`)}
        </Button>
      ) : null}
    </fieldset>
  )
}
