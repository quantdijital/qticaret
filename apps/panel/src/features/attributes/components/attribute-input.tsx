import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type {
  AttributeDefinition,
  AttributeOption,
  AttributeValue,
} from "@/features/attributes/types"
import { withAdded } from "@/features/attributes/form"
import { NewValue } from "./new-value"
import type { AddValue } from "./new-value"

const NONE = "__none__"
const NEW = "__new__"

interface AttributeInputProps {
  definition: AttributeDefinition
  value: AttributeValue | undefined
  onChange: (value: AttributeValue) => void
  /** An i18n'd error sentence under the field (a required one left empty). */
  error?: string | undefined
  /** A list field's missing value added to the group from here; none: only its values. */
  addOption?: AddValue | undefined
}

/** The field for one attribute, by its type; an empty field means "no value" (null). */
export function AttributeInput({
  definition,
  value,
  onChange,
  error,
  addOption,
}: AttributeInputProps) {
  const { t } = useTranslation()
  const id = `attribute-${definition.key}`
  // Added here: shown at once, before the saved group comes back with them
  const [added, setAdded] = useState<AttributeOption[]>([])
  const [adding, setAdding] = useState(false)
  const options = withAdded(definition.options ?? [], added)
  const label = `${definition.label}${definition.unit ? ` (${definition.unit})` : ""}`
  const newValue = (pick: (option: AttributeOption) => void) =>
    addOption ? (
      <NewValue
        label={definition.label}
        open={adding}
        onOpenChange={setAdding}
        add={addOption}
        onAdded={(option) => {
          setAdded((was) => [...was, option])
          pick(option)
        }}
      />
    ) : null

  if (definition.type === "boolean") {
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2.5"
      >
        <span className="text-sm font-medium">{label}</span>
        <Switch
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => {
            onChange(checked)
          }}
        />
      </label>
    )
  }
  if (definition.type === "multi_select") {
    const selected = Array.isArray(value) ? value : []
    return (
      <Field label={label} required={definition.is_required} error={error}>
        <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={(checked) => {
                  const next =
                    checked === true
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value)
                  onChange(next.length === 0 ? null : next)
                }}
              />
              {option.label}
            </label>
          ))}
          {adding ? null : newValue(() => undefined)}
        </div>
        {adding
          ? newValue((option) => {
              onChange([...selected.filter((item) => item !== option.value), option.value])
            })
          : null}
      </Field>
    )
  }
  return (
    <Field label={label} htmlFor={id} required={definition.is_required} error={error}>
      {definition.type === "select" ? (
        <div className="flex flex-col gap-2">
          <Select
            value={typeof value === "string" ? value : NONE}
            onValueChange={(next) => {
              if (next === NEW) {
                setAdding(true)
                return
              }
              // Radix's hidden select reports "" for a value whose option it has not drawn yet
              // (one just added): no value is NONE, never ""
              if (next === "") {
                return
              }
              onChange(next === NONE ? null : next)
            }}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("attributes.noValue")}</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              {addOption ? (
                <SelectItem value={NEW} className="text-muted-foreground">
                  <Plus />
                  {t("attributes.newValue")}
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          {adding
            ? newValue((option) => {
                onChange(option.value)
              })
            : null}
        </div>
      ) : definition.type === "number" ? (
        <NumberField
          plain
          decimals={3}
          id={id}
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => {
            const text = event.target.value
            onChange(text === "" ? null : Number(text))
          }}
        />
      ) : (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            onChange(event.target.value === "" ? null : event.target.value)
          }}
        />
      )}
    </Field>
  )
}
