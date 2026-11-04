import { Plus } from "lucide-react"
import { useState } from "react"
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TemplateForm } from "@/features/attributes/form"
import { GROUP_LIMITS, groupKey } from "@/features/attributes/groups"
import { RowActions, RowCell } from "@/features/settings/components/storefront-rows"

const G = "attributes.groups"
const NONE = "__none__"

/**
 * The template's spec table sections (adr/0013 Ek 2026-11-04): added by
 * name, renamed, reordered, removed. Optional: a template without them
 * shows one list. A removed section's fields fall back to none.
 */
export function GroupList() {
  const { t } = useTranslation()
  const { control, register, getValues, setValue, formState } = useFormContext<TemplateForm>()
  const groups = useFieldArray({ control, name: "groups", keyName: "fieldKey" })
  const [draft, setDraft] = useState("")
  const full = groups.fields.length >= GROUP_LIMITS.groups
  const add = () => {
    const name = draft.trim()
    if (!name || full) {
      return
    }
    const taken = getValues("groups").map((group) => group.key)
    groups.append({ key: groupKey(name, taken), name })
    setDraft("")
  }
  const remove = (index: number) => {
    const key = getValues(`groups.${index}.key`)
    groups.remove(index)
    getValues("definitions").forEach((definition, at) => {
      if (definition.group === key) {
        setValue(`definitions.${at}.group`, "", { shouldDirty: true })
      }
    })
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t(`${G}.title`)}</span>
        <p className="text-xs text-muted-foreground">{t(`${G}.hint`)}</p>
      </div>
      {groups.fields.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {groups.fields.map((field, index) => {
            const number = index + 1
            const id = `template-group-${index}`
            const error = formState.errors.groups?.[index]?.name
              ? t(`${G}.nameRequired`)
              : undefined
            return (
              <li key={field.fieldKey} className="flex items-start gap-2">
                <RowCell error={error} errorId={`${id}-error`} className="flex-1">
                  <Input
                    id={id}
                    aria-label={t(`${G}.nameOf`, { number })}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    maxLength={GROUP_LIMITS.nameLength}
                    {...register(`groups.${index}.name`, {
                      validate: (name) => name.trim().length > 0,
                    })}
                  />
                </RowCell>
                <RowActions
                  index={index}
                  count={groups.fields.length}
                  item={t(`${G}.item`, { number })}
                  onMove={(to) => {
                    groups.move(index, to)
                  }}
                  onRemove={() => {
                    remove(index)
                  }}
                />
              </li>
            )
          })}
        </ol>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t(`${G}.newName`)}
          placeholder={t(`${G}.newPlaceholder`)}
          value={draft}
          maxLength={GROUP_LIMITS.nameLength}
          disabled={full}
          className="w-full sm:w-72"
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            // Enter adds the group; it never sends the template
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" disabled={full || !draft.trim()} onClick={add}>
          <Plus />
          {t(`${G}.add`)}
        </Button>
        {full ? (
          <span className="text-xs text-muted-foreground">
            {t(`${G}.full`, { max: GROUP_LIMITS.groups })}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** A field's section in the spec table; offered once the template has sections. */
export function DefinitionGroupField({ index }: { index: number }) {
  const { t } = useTranslation()
  const { control } = useFormContext<TemplateForm>()
  const groups = useWatch({ control, name: "groups" })
  const id = `definitions.${index}-group`
  if (groups.length === 0) {
    return null
  }
  return (
    <Field label={t(`${G}.field`)} htmlFor={id} hint={t(`${G}.fieldHint`)}>
      <Controller
        control={control}
        name={`definitions.${index}.group`}
        render={({ field }) => (
          <Select
            value={field.value || NONE}
            onValueChange={(next) => {
              field.onChange(next === NONE ? "" : next)
            }}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t(`${G}.none`)}</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.key} value={group.key}>
                  {group.name.trim() || t(`${G}.unnamed`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}
