import { useTranslation } from "react-i18next"
import type { BillingPeriod } from "@qticaret/types/control-plane"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"

/** A package's price and days as the form holds them (Turkish text). */
export interface PriceDraft {
  price: string
  period: BillingPeriod
  trial: string
  grace: string
}

/**
 * A package's price (lira, two decimals; sent as kuruş), its period and
 * the trial and grace days a subscription starts with.
 */
export function PriceFields({
  draft,
  disabled,
  onChange,
}: {
  draft: PriceDraft
  disabled: boolean
  onChange: <K extends keyof PriceDraft>(key: K, value: PriceDraft[K]) => void
}) {
  const { t } = useTranslation()
  const days = (key: "trial" | "grace") => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`package-${key}`}>{t(`packages.${key}`)}</Label>
      <NumberField
        id={`package-${key}`}
        min={0}
        disabled={disabled}
        suffix={t("packages.days")}
        value={draft[key]}
        onChange={(event) => {
          onChange(key, event.target.value)
        }}
      />
    </div>
  )
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="package-price">{t("packages.price")}</Label>
        <NumberField
          id="package-price"
          min={0}
          decimals={2}
          suffix="₺"
          disabled={disabled}
          value={draft.price}
          onChange={(event) => {
            onChange("price", event.target.value)
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p id="package-period-label" className="text-sm font-medium">
          {t("packages.periodTitle")}
        </p>
        <RadioGroup
          aria-labelledby="package-period-label"
          value={draft.period}
          disabled={disabled}
          onValueChange={(next) => {
            onChange("period", next as BillingPeriod)
          }}
          className="flex h-9 items-center gap-6"
        >
          {(["monthly", "yearly"] as const).map((period) => (
            <div key={period} className="flex items-center gap-2">
              <RadioGroupItem id={`package-period-${period}`} value={period} />
              <Label htmlFor={`package-period-${period}`} className="font-normal">
                {t(`packages.periodName.${period}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      {days("trial")}
      {days("grace")}
    </div>
  )
}
