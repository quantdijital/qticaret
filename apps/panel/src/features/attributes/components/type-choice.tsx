import { useId } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { TemplateForm } from "@/features/attributes/form"
import { ATTRIBUTE_TYPES } from "@/features/attributes/types"

const A = "attributes"

/**
 * What a new attribute holds, as cards with an example each ("Sayı ·
 * Örn. Ağırlık: 120 g"), so the choice reads without knowing the words.
 * A saved one's type is fixed: its name only.
 */
export function TypeChoice({ index, saved }: { index: number; saved: boolean }) {
  const { t } = useTranslation()
  const { control } = useFormContext<TemplateForm>()
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline gap-1.5">
        <span id={labelId} className="text-sm font-medium">
          {t(`${A}.type`)}
        </span>
        {saved ? <InfoTip name={t(`${A}.type`)} hint={t(`${A}.typeFixed`)} /> : null}
      </span>
      <Controller
        control={control}
        name={`definitions.${index}.type`}
        render={({ field }) =>
          saved ? (
            <p className="text-sm">{t(`${A}.types.${field.value}`)}</p>
          ) : (
            <RadioGroup
              aria-labelledby={labelId}
              value={field.value}
              onValueChange={(next) => {
                field.onChange(next)
              }}
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {ATTRIBUTE_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem value={type} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{t(`${A}.types.${type}`)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`${A}.typeExamples.${type}`)}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )
        }
      />
    </div>
  )
}
