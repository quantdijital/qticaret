import { useTranslation } from "react-i18next"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { FREE_SHIPPING_CLASS } from "@/features/settings/api/sections"
import type { ShippingClass } from "@/features/settings/api/sections"
import { STANDARD_CLASS } from "./shipping-class"

const S = "products.shippingClass"

/**
 * The product's shipping class (adr/0087 §4), above the parcel's measures:
 * Standard, "Ücretsiz kargo" or one of the shop's classes, with one line
 * saying what it does to the order's shipping.
 */
export function ShippingClassField({
  value,
  onChange,
  classes,
}: {
  value: string
  onChange: (value: string) => void
  classes: readonly ShippingClass[]
}) {
  const { t } = useTranslation()
  const chosen = classes.find((each) => each.key === value)
  const gone = value !== STANDARD_CLASS && value !== FREE_SHIPPING_CLASS && !chosen
  const hint = gone
    ? t(`${S}.gone`)
    : value === FREE_SHIPPING_CLASS
      ? t(`${S}.hintFree`)
      : chosen && chosen.surcharge > 0
        ? t(`${S}.hintSurcharge`, { amount: formatMoney(chosen.surcharge / 100, "try") })
        : t(`${S}.hintStandard`)
  return (
    <Field label={t(`${S}.label`)} htmlFor="detail-shipping-class" hint={hint}>
      <Select value={gone ? STANDARD_CLASS : value} onValueChange={onChange}>
        <SelectTrigger id="detail-shipping-class" className="w-full @md:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={STANDARD_CLASS}>{t(`${S}.standard`)}</SelectItem>
          <SelectItem value={FREE_SHIPPING_CLASS}>{t(`${S}.free`)}</SelectItem>
          {classes.map((each) => (
            <SelectItem key={each.key} value={each.key}>
              {each.surcharge > 0
                ? `${each.name} (+${formatMoney(each.surcharge / 100, "try")})`
                : each.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
