import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TemplateForm } from "@/features/attributes/form"
import { OptionChips } from "./option-chips"
import { ATTRIBUTE_TYPES, VARIES_BY, isSelectType } from "@/features/attributes/types"

const NONE = "__none__"

interface DefinitionEditorProps {
  index: number
  count: number
  onMove: (step: -1 | 1) => void
  onRemove: () => void
}

/** One attribute of the template: what it is called, its kind and where it shows. */
export function DefinitionEditor({ index, count, onMove, onRemove }: DefinitionEditorProps) {
  const { t } = useTranslation()
  const { control, register, setValue } = useFormContext<TemplateForm>()
  const base = `definitions.${index}` as const
  const [label, type, scope, id, shown] = useWatch({
    control,
    name: [`${base}.label`, `${base}.type`, `${base}.scope`, `${base}.id`, `${base}.is_public`],
  })
  const [open, setOpen] = useState(!id)
  // A product option is always shown: no choice offered for it (T5)
  const flags =
    scope === "variant"
      ? (["is_required", "is_filterable", "is_seo_highlight"] as const)
      : (["is_public", "is_required", "is_filterable", "is_seo_highlight"] as const)
  // What a hidden attribute cannot be: a filter, a title's word
  const needsShown = (flag: string) =>
    scope !== "variant" && !shown && (flag === "is_filterable" || flag === "is_seo_highlight")

  return (
    <li className="rounded-lg border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setOpen((was) => !was)
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{label || t("attributes.untitled")}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {t(`attributes.types.${type}`)}
          </span>
          {scope === "variant" ? (
            <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px]">
              {t("attributes.variantBadge")}
            </span>
          ) : null}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={index === 0}
          aria-label={t("attributes.moveUp")}
          onClick={() => {
            onMove(-1)
          }}
        >
          <ChevronUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={index === count - 1}
          aria-label={t("attributes.moveDown")}
          onClick={() => {
            onMove(1)
          }}
        >
          <ChevronDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive-text"
          aria-label={t("attributes.remove")}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      {open ? (
        <div className="flex flex-col gap-4 border-t px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("attributes.label")} htmlFor={`${base}-label`} required>
              <Input id={`${base}-label`} {...register(`${base}.label`)} />
            </Field>
            <Field label={t("attributes.type")} htmlFor={`${base}-type`}>
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
                          {t(`attributes.types.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          {type === "number" || type === "text" ? (
            <Field
              label={t("attributes.unit")}
              htmlFor={`${base}-unit`}
              hint={t("attributes.unitHint")}
            >
              <Input id={`${base}-unit`} className="w-40" {...register(`${base}.unit`)} />
            </Field>
          ) : null}
          {isSelectType(type) ? (
            <Field label={t("attributes.options")} hint={t("attributes.optionsHint")}>
              <Controller
                control={control}
                name={`${base}.options`}
                render={({ field }) => (
                  <OptionChips value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {flags.map((flag) => (
              <Controller
                key={flag}
                control={control}
                name={`${base}.${flag}`}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm has-disabled:cursor-not-allowed has-disabled:text-muted-foreground">
                    <Checkbox
                      checked={field.value && !needsShown(flag)}
                      disabled={needsShown(flag)}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true)
                        if (flag === "is_public" && checked !== true) {
                          setValue(`${base}.is_filterable`, false)
                          setValue(`${base}.is_seo_highlight`, false)
                        }
                      }}
                    />
                    {t(`attributes.flags.${flag}`)}
                  </label>
                )}
              />
            ))}
          </div>
          <Field label={t("attributes.scope")} hint={t("attributes.scopeHint")}>
            <Controller
              control={control}
              name={`${base}.scope`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{t("attributes.scopes.product")}</SelectItem>
                    <SelectItem value="variant">{t("attributes.scopes.variant")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {scope === "variant" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("attributes.optionTitle")}
                htmlFor={`${base}-option`}
                hint={t("attributes.optionTitleHint")}
                required
              >
                <Input id={`${base}-option`} {...register(`${base}.option_title`)} />
              </Field>
              <Field label={t("attributes.variesBy")} hint={t("attributes.variesByHint")}>
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
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("attributes.variesByNone")}</SelectItem>
                        {VARIES_BY.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`attributes.variesByOptions.${option}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export function AddDefinitionButton({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  return (
    <Button type="button" variant="outline" size="sm" className="self-start" onClick={onAdd}>
      <Plus />
      {t("attributes.add")}
    </Button>
  )
}
