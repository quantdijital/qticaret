import { Controller, useFormContext } from "react-hook-form"
import type { FieldPathByValue } from "react-hook-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import type { PopupValues } from "@/features/popups/form"
import { useFieldError } from "./use-field-error"

/** A whole number of the form, with its unit; the schema says what is out of range. */
export function NumberInput({
  name,
  label,
  min,
  max,
  suffix,
}: {
  name: FieldPathByValue<PopupValues, number>
  label: string
  min: number
  max: number
  suffix?: string | undefined
}) {
  const { control } = useFormContext<PopupValues>()
  const error = useFieldError()
  const id = `popup-${name.replace(/_/g, "-")}`
  return (
    <Field label={label} htmlFor={id} error={error(name)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <NumberField
            id={id}
            plain
            min={min}
            max={max}
            {...(suffix ? { suffix } : {})}
            value={Number.isFinite(field.value) ? field.value : ""}
            aria-invalid={error(name) ? true : undefined}
            onBlur={field.onBlur}
            onChange={(event) => {
              const text = event.target.value.trim()
              field.onChange(text === "" ? Number.NaN : Math.trunc(Number(text)))
            }}
          />
        )}
      />
    </Field>
  )
}
