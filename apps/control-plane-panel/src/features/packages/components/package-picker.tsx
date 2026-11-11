import { useTranslation } from "react-i18next"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { Plan } from "@/features/packages/api"
import { limitText, priceText } from "@/features/packages/format"

export const NO_PACKAGE = "none"

/**
 * A package to put a shop on: each with its price and its main limits,
 * and "no package" first. An archived package is offered only when it is
 * the shop's own already (it stays on it; no new shop takes it).
 */
export function PackagePicker({
  id,
  plans,
  value,
  current,
  onChange,
}: {
  id: string
  plans: readonly Plan[]
  /** A package id, or `NO_PACKAGE`. */
  value: string
  /** The shop's own package: shown even when archived. */
  current?: string | null
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const offered = plans.filter((plan) => plan.archived_at === null || plan.id === current)
  return (
    <RadioGroup
      aria-labelledby={`${id}-label`}
      value={value}
      onValueChange={onChange}
      className="flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem id={`${id}-${NO_PACKAGE}`} value={NO_PACKAGE} className="mt-0.5" />
        <Label
          htmlFor={`${id}-${NO_PACKAGE}`}
          className="flex flex-col items-start gap-0.5 font-normal"
        >
          <span className="text-sm font-medium">{t("plan.none")}</span>
          <span className="text-[13px] leading-5 text-muted-foreground">{t("plan.noneText")}</span>
        </Label>
      </div>
      {offered.map((plan) => (
        <div key={plan.id} className="flex items-start gap-3">
          <RadioGroupItem id={`${id}-${plan.id}`} value={plan.id} className="mt-0.5" />
          <Label
            htmlFor={`${id}-${plan.id}`}
            className="flex flex-col items-start gap-0.5 font-normal"
          >
            <span className="text-sm font-medium">
              {plan.name}
              {plan.archived_at ? ` (${t("packages.archivedMark")})` : ""}
            </span>
            <span className="text-[13px] leading-5 text-muted-foreground">
              {t("plan.pickerLine", {
                price: priceText(t, plan),
                products: limitText(t, "products", plan.limits.products),
                staff: limitText(t, "staff", plan.limits.staff),
              })}
            </span>
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}
