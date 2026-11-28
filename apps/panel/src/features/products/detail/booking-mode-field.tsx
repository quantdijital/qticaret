import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { CatalogValues } from "./catalog-fields"
import { SwitchName } from "./hint-parts"

const B = "products.booking.mode"

/**
 * "Tarihli satış (kalkışlı)" (adr/0076 §2): a service sold by departure,
 * each with its own places; off by default. The reserved range mode is
 * never offered.
 */
export function BookingModeField({ form }: { form: UseFormReturn<CatalogValues> }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start justify-between gap-4">
      <SwitchName
        htmlFor="catalog-booking"
        label={t(`${B}.label`)}
        term="booking_mode"
        hint={t(`${B}.hint`)}
        hintId="catalog-booking-hint"
      />
      <Controller
        control={form.control}
        name="booking"
        render={({ field }) => (
          <Switch
            id="catalog-booking"
            aria-describedby="catalog-booking-hint"
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
    </div>
  )
}
