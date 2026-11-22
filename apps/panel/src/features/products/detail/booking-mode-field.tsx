import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { CatalogValues } from "./catalog-fields"

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
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <label htmlFor="catalog-booking" className="text-sm font-medium">
            {t(`${B}.label`)}
          </label>
          <small className="text-[11px] text-muted-foreground">booking_mode</small>
        </div>
        <span id="catalog-booking-hint" className="text-[13px] text-muted-foreground">
          {t(`${B}.hint`)}
        </span>
      </div>
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
