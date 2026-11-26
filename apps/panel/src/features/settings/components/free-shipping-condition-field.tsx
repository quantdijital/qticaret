import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { FREE_SHIPPING_CONDITIONS } from "@/features/settings/api/sections"
import type { FreeShippingCondition } from "@/features/settings/api/sections"

const S = "settings.shipping.fee.condition"

/**
 * "Koşul" beside the free shipping total (WooCommerce's "Free shipping
 * requires"): the total alone, the total or a free shipping coupon, or
 * both. The server holds it at checkout; this only says which is kept.
 */
export function FreeShippingConditionField({
  id,
  value,
  onChange,
}: {
  id: string
  value: FreeShippingCondition
  onChange: (next: FreeShippingCondition) => void
}) {
  const { t } = useTranslation()
  return (
    <Field label={t(`${S}.label`)} htmlFor={id} hint={t(`${S}.hints.${value}`)}>
      <Select
        value={value}
        onValueChange={(next) => {
          // Radix's hidden native select says "" as it mounts in a form
          if (next !== "") {
            onChange(next as FreeShippingCondition)
          }
        }}
      >
        <SelectTrigger id={id} className="w-full" data-testid="free-shipping-condition">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FREE_SHIPPING_CONDITIONS.map((each) => (
            <SelectItem key={each} value={each}>
              {t(`${S}.options.${each}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
