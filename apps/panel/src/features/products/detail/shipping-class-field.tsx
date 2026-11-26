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
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { FREE_SHIPPING_CLASS } from "@/features/settings/api/sections"
import type { ShippingClass } from "@/features/settings/api/sections"
import { STANDARD_CLASS } from "./shipping-class"

const S = "products.shippingClass"

/**
 * The product's shipping (adr/0087 §4; the owner, 2026-11-26: a switch,
 * not a class list): "Bu ürünün kargosu ücretsiz" is the built-in free
 * class; only while it is off and the shop made surcharge classes
 * (Settings > Shipping > Gelişmiş) a small select picks one of them.
 * One line says what it does to the order's shipping.
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
  const free = value === FREE_SHIPPING_CLASS
  const chosen = classes.find((each) => each.key === value)
  const gone = !free && value !== STANDARD_CLASS && !chosen
  const hint = gone
    ? t(`${S}.gone`)
    : free
      ? t(`${S}.hintFree`)
      : chosen && chosen.surcharge > 0
        ? t(`${S}.hintSurcharge`, { amount: formatMoney(chosen.surcharge / 100, "try") })
        : t(`${S}.hintStandard`)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="detail-shipping-free" className="text-sm font-medium">
            {t(`${S}.freeSwitch`)}
          </label>
          <p id="detail-shipping-free-hint" className="text-[13px] text-muted-foreground">
            {hint}
          </p>
        </div>
        <Switch
          id="detail-shipping-free"
          checked={free}
          aria-describedby="detail-shipping-free-hint"
          onCheckedChange={(on) => {
            onChange(on ? FREE_SHIPPING_CLASS : STANDARD_CLASS)
          }}
        />
      </div>
      {!free && classes.length > 0 ? (
        <Field label={t(`${S}.label`)} htmlFor="detail-shipping-class">
          <Select
            value={gone ? STANDARD_CLASS : value}
            onValueChange={(next) => {
              // Radix's hidden native select says "" as it mounts inside a form: not a choice
              if (next !== "") {
                onChange(next)
              }
            }}
          >
            <SelectTrigger id="detail-shipping-class" className="w-full @md:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STANDARD_CLASS}>{t(`${S}.standard`)}</SelectItem>
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
      ) : null}
    </div>
  )
}
