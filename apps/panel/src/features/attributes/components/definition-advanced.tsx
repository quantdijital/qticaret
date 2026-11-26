import { ChevronDown, ChevronRight } from "lucide-react"
import { useId, useState } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { advancedChanges } from "@/features/attributes/definition-list"
import type { TemplateForm } from "@/features/attributes/form"
import { VARIES_BY } from "@/features/attributes/types"
import { AliasChips } from "./alias-chips"
import { FlagSwitch } from "./flag-switch"

const A = "attributes"
const NONE = "__none__"

/**
 * What most attributes never need, folded: where it is kept (on the
 * product or as a product option), the option's name and Google's word
 * for it, the search title, a text's unit and its other names. The folded
 * header counts what differs from the defaults: nothing set hides here.
 */
export function DefinitionAdvanced({ index }: { index: number }) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<TemplateForm>()
  const base = `definitions.${index}` as const
  const definition = useWatch({ control, name: base })
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const changes = advancedChanges(definition)
  const variant = definition.scope === "variant"
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        className="flex h-8 items-center gap-1.5 self-start rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => {
          setOpen((was) => !was)
        }}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {t(`${A}.advanced.title`)}
        {changes > 0 ? (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {t(`${A}.advanced.changed`, { count: changes })}
          </Badge>
        ) : null}
      </button>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-4 border-l pl-4">
          <Field label={t(`${A}.scope`)} htmlFor={`${base}-scope`} hint={t(`${A}.scopeHint`)}>
            <Controller
              control={control}
              name={`${base}.scope`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${base}-scope`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{t(`${A}.scopes.product`)}</SelectItem>
                    <SelectItem value="variant">{t(`${A}.scopes.variant`)}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {variant ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t(`${A}.optionTitle`)}
                htmlFor={`${base}-option`}
                hint={t(`${A}.optionTitleHint`)}
                required
              >
                <Input
                  placeholder={t("attributes.placeholders.optionTitle")}
                  id={`${base}-option`}
                  {...register(`${base}.option_title`)}
                />
              </Field>
              <Field
                label={t(`${A}.variesBy`)}
                htmlFor={`${base}-varies`}
                hint={t(`${A}.variesByHint`)}
              >
                <Controller
                  control={control}
                  name={`${base}.varies_by`}
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(next) => {
                        field.onChange(next === NONE ? "" : next)
                      }}
                    >
                      <SelectTrigger id={`${base}-varies`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t(`${A}.variesByNone`)}</SelectItem>
                        {VARIES_BY.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`${A}.variesByOptions.${option}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          ) : null}
          <div className="sm:w-1/2">
            <FlagSwitch index={index} flag="is_seo_highlight" />
          </div>
          {definition.type === "text" ? (
            <Field label={t(`${A}.unit`)} htmlFor={`${base}-unit`} hint={t(`${A}.textUnitHint`)}>
              <Input
                placeholder={t("attributes.placeholders.textUnit")}
                id={`${base}-unit`}
                className="sm:w-1/2"
                {...register(`${base}.unit`)}
              />
            </Field>
          ) : null}
          {variant ? null : (
            <Field label={t(`${A}.aliases`)} hint={t(`${A}.aliasesHint`)}>
              <Controller
                control={control}
                name={`${base}.aliases`}
                render={({ field }) => <AliasChips value={field.value} onChange={field.onChange} />}
              />
            </Field>
          )}
        </div>
      ) : null}
    </div>
  )
}
