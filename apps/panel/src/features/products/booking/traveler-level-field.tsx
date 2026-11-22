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
import { TRAVELER_LEVELS } from "@/features/products/api/booking"
import type { SettingsDraft } from "./slot-schemas"

const B = "products.booking.settings"

/**
 * What checkout asks of each traveler (adr/0076 §7), one choice of five,
 * each adding to the one before: none, the name, + birth date, + ID or
 * passport number, + nationality. Never an ID's picture.
 */
export function TravelerLevelField({ control }: { control: Control<SettingsDraft> }) {
  const { t } = useTranslation()
  return (
    <Field
      label={t(`${B}.travelerLevel`)}
      htmlFor="booking-traveler-level"
      hint={t(`${B}.travelerLevelHint`)}
    >
      <Controller
        control={control}
        name="traveler_level"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="booking-traveler-level" className="w-full sm:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAVELER_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {t(`${B}.travelerLevels.${level}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}
