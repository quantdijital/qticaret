import { Checkbox, Input, Label, Select, Switch, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import type { AttributeDefinition, AttributeValue } from "../../lib/attributes"

interface AttributeInputProps {
  definition: AttributeDefinition
  value: AttributeValue | undefined
  error?: string | undefined
  onChange: (value: AttributeValue) => void
}

const NONE = "__none__"

/** The field for one attribute, by its type; an empty field means "no value" (null). */
export function AttributeInput({ definition, value, error, onChange }: AttributeInputProps) {
  const { t } = useTranslation()
  const id = `attribute-${definition.key}`
  const options = definition.options ?? []
  const label = (
    <Label htmlFor={id} size="small" weight="plus">
      {definition.label}
      {definition.is_required ? " *" : ""}
      {definition.unit ? ` (${definition.unit})` : ""}
    </Label>
  )

  let field: React.ReactNode
  switch (definition.type) {
    case "boolean":
      field = (
        <Switch
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => {
            onChange(checked)
          }}
        />
      )
      break
    case "number":
      field = (
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
      )
      break
    case "select":
      field = (
        <Select
          value={typeof value === "string" ? value : NONE}
          onValueChange={(selected) => {
            onChange(selected === NONE ? null : selected)
          }}
        >
          <Select.Trigger id={id}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={NONE}>{t("qticaret.attributes.noValue")}</Select.Item>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      )
      break
    case "multi_select": {
      const selected = Array.isArray(value) ? value : []
      field = (
        <div id={id} role="group" className="flex flex-col gap-2">
          {options.map((option) => {
            const optionId = `${id}-${option.value}`
            return (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={optionId}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const next =
                      checked === true
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value)
                    onChange(next.length === 0 ? null : next)
                  }}
                />
                <Label htmlFor={optionId} size="small">
                  {option.label}
                </Label>
              </div>
            )
          })}
        </div>
      )
      break
    }
    case "text":
      field = (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            onChange(event.target.value === "" ? null : event.target.value)
          }}
        />
      )
  }

  return (
    <div className="flex flex-col gap-2">
      {label}
      {field}
      {error && (
        <Text size="xsmall" className="text-ui-fg-error">
          {error}
        </Text>
      )}
    </div>
  )
}
