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
import { cn } from "@qticaret/admin-ui/lib/utils"
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
  /** One row of a list (`@container/attrs`): the name on the left once there is room. */
  row?: boolean
}

/**
 * A field as one row of the product's attributes (the owner 2026-11-26,
 * WooCommerce's attribute rows): its name above on a phone, on the left
 * of its control once the list (`@container/attrs`) has room; a hint, an
 * error or a new value's field stays under the control.
 */
export const ATTRIBUTE_ROW =
  "@lg/attrs:grid @lg/attrs:grid-cols-[11rem_minmax(0,1fr)] @lg/attrs:items-start @lg/attrs:gap-x-6 @lg/attrs:gap-y-2 @lg/attrs:[&>*:not(label)]:col-start-2 @lg/attrs:[&>label]:pt-2"

/** The field for one attribute, by its type; an empty field means "no value" (null). */
export function AttributeInput({
  definition,
  value,
  onChange,
  error,
  addOption,
  row = false,
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
        className={cn(
          "flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2.5",
          // A row: the name in the names' column, the switch where the controls start
          row &&
            "@lg/attrs:grid @lg/attrs:grid-cols-[11rem_minmax(0,1fr)] @lg/attrs:justify-items-start @lg/attrs:gap-x-6 @lg/attrs:rounded-none @lg/attrs:border-0 @lg/attrs:p-0 @lg/attrs:py-2"
        )}
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
      <Field
        label={label}
        required={definition.is_required}
        error={error}
        className={row ? ATTRIBUTE_ROW : ""}
      >
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
    <Field
      label={label}
      htmlFor={id}
      required={definition.is_required}
      error={error}
      className={row ? ATTRIBUTE_ROW : ""}
    >
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
          placeholder={t("attributes.placeholders.value")}
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
