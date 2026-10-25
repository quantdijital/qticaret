import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { AttributeDefinition, AttributeValue } from "@/features/attributes/types"

const NONE = "__none__"

interface AttributeInputProps {
  definition: AttributeDefinition
  value: AttributeValue | undefined
  onChange: (value: AttributeValue) => void
}

/** The field for one attribute, by its type; an empty field means "no value" (null). */
export function AttributeInput({ definition, value, onChange }: AttributeInputProps) {
  const { t } = useTranslation()
  const id = `attribute-${definition.key}`
  const options = definition.options ?? []
  const label = `${definition.label}${definition.unit ? ` (${definition.unit})` : ""}`

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
      <Field label={label} required={definition.is_required}>
        <div role="group" aria-label={label} className="flex flex-wrap gap-2">
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
        </div>
      </Field>
    )
  }
  return (
    <Field label={label} htmlFor={id} required={definition.is_required}>
      {definition.type === "select" ? (
        <Select
          value={typeof value === "string" ? value : NONE}
          onValueChange={(next) => {
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
          </SelectContent>
        </Select>
      ) : definition.type === "number" ? (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
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
