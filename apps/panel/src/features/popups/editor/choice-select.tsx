import { Controller, useFormContext } from "react-hook-form"
import type { FieldPathByValue } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import type { PopupValues } from "@/features/popups/form"

/** One of a short list, by its words (`popups.choices.<name>.<value>`). */
export function ChoiceSelect({
  name,
  options,
  label,
  onPicked,
}: {
  name: FieldPathByValue<PopupValues, string>
  options: readonly string[]
  label: string
  /** After the value is set: a choice another field follows. */
  onPicked?: (value: string) => void
}) {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  const id = `popup-${name.replace(/_/g, "-")}`
  return (
    <Field label={label} htmlFor={id}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(next) => {
              field.onChange(next)
              onPicked?.(next)
            }}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`popups.choices.${name}.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}
