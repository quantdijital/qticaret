import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import type { TemplateForm } from "@/features/attributes/form"
import { ATTRIBUTE_TYPES, isSelectType } from "@/features/attributes/types"
import { DefinitionAdvanced } from "./definition-advanced"
import { FlagSwitch } from "./flag-switch"
import { DefinitionGroupField } from "./group-list"
import { OptionChips } from "./option-chips"

const A = "attributes"

/**
 * An open attribute's fields: its name and type, then only what the type
 * needs (a number's unit, a choice's options), its section once the
 * template has sections, the three everyday switches, and the rest
 * folded under "Gelişmiş".
 */
export function DefinitionFields({ index }: { index: number }) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<TemplateForm>()
  const base = `definitions.${index}` as const
  const [type, id] = useWatch({ control, name: [`${base}.type`, `${base}.id`] })
  return (
    <div className="flex flex-col gap-5 border-t px-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(`${A}.label`)} htmlFor={`${base}-label`} required>
          <Input id={`${base}-label`} {...register(`${base}.label`)} />
        </Field>
        <Field
          label={t(`${A}.type`)}
          htmlFor={`${base}-type`}
          hint={id ? t(`${A}.typeFixed`) : undefined}
        >
          <Controller
            control={control}
            name={`${base}.type`}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(id)}>
                <SelectTrigger id={`${base}-type`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTE_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`${A}.types.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        {type === "number" ? (
          <Field label={t(`${A}.unit`)} htmlFor={`${base}-unit`} hint={t(`${A}.unitHint`)}>
            <Input id={`${base}-unit`} {...register(`${base}.unit`)} />
          </Field>
        ) : null}
        <DefinitionGroupField index={index} />
      </div>
      {isSelectType(type) ? (
        <Field label={t(`${A}.options`)} hint={t(`${A}.optionsHint`)}>
          <Controller
            control={control}
            name={`${base}.options`}
            render={({ field }) => <OptionChips value={field.value} onChange={field.onChange} />}
          />
        </Field>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-3">
        <FlagSwitch index={index} flag="is_public" />
        <FlagSwitch index={index} flag="is_required" />
        <FlagSwitch index={index} flag="is_filterable" />
      </div>
      <DefinitionAdvanced index={index} />
    </div>
  )
}
