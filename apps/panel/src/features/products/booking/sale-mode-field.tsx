import { Controller } from "react-hook-form"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { SALE_MODES } from "@/features/products/api/booking"
import type { SettingsDraft } from "./slot-schemas"

const B = "products.booking.settings"

/**
 * How the product is sold (adr/0076 Ek 2026-11-23): online through the
 * cart (the default, today's way), only by a "call me" request with no
 * payment, or both. Requests land in Müşteriler > İletişim mesajları.
 */
export function SaleModeField({ control }: { control: Control<SettingsDraft> }) {
  const { t } = useTranslation()
  return (
    <Field label={t(`${B}.saleMode`)} htmlFor="booking-sale-mode" hint={t(`${B}.saleModeHint`)}>
      <Controller
        control={control}
        name="sale_mode"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="booking-sale-mode" className="w-full sm:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALE_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`${B}.saleModes.${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}
