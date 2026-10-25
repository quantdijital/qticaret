/* eslint-disable @typescript-eslint/restrict-template-expressions --
   react-hook-form types field paths as `definitions.${number}.key`; a
   number in the path is what the form library expects */
import { Button, Checkbox, Input, Label, Select, Text } from "@medusajs/ui"
import { Controller, useFieldArray, useWatch } from "react-hook-form"
import type { Control, UseFormGetValues, UseFormSetValue } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toSlug } from "../../../../lib/seo"
import { ATTRIBUTE_TYPES, VARIES_BY, isSelectType } from "../../../lib/attributes"
import type { TemplateForm } from "./form"

const NONE = "__none__"

interface DefinitionFieldsProps {
  control: Control<TemplateForm>
  getValues: UseFormGetValues<TemplateForm>
  setValue: UseFormSetValue<TemplateForm>
  index: number
  onRemove: () => void
}

/** One attribute of the template being edited (adr/0013). */
export function DefinitionFields({
  control,
  getValues,
  setValue,
  index,
  onRemove,
}: DefinitionFieldsProps) {
  const { t } = useTranslation()
  const base = `definitions.${index}` as const
  const type = useWatch({ control, name: `${base}.type` })
  const scope = useWatch({ control, name: `${base}.scope` })
  const options = useFieldArray({ control, name: `${base}.options` })
  const text = (
    name: `${typeof base}.${"key" | "label" | "unit" | "option_title"}`,
    label: string,
    hint?: string
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${name}-input`} size="xsmall" weight="plus">
            {label}
          </Label>
          <Input id={`${name}-input`} size="small" {...field} />
          {hint && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {hint}
            </Text>
          )}
        </div>
      )}
    />
  )
  const flag = (
    name: `${typeof base}.${"is_required" | "is_filterable" | "is_seo_highlight"}`,
    label: string
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${name}-input`}
            checked={field.value}
            onCheckedChange={(checked) => {
              field.onChange(checked === true)
            }}
          />
          <Label htmlFor={`${name}-input`} size="xsmall">
            {label}
          </Label>
        </div>
      )}
    />
  )

  return (
    <fieldset className="border-ui-border-base flex flex-col gap-3 rounded-md border p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {text(`${base}.label`, t("qticaret.attributeTemplates.definition.label"))}
        {text(
          `${base}.key`,
          t("qticaret.attributeTemplates.definition.key"),
          t("qticaret.attributeTemplates.definition.keyHint")
        )}
        <Controller
          control={control}
          name={`${base}.type`}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <Label size="xsmall" weight="plus">
                {t("qticaret.attributeTemplates.definition.type")}
              </Label>
              <Select size="small" value={field.value} onValueChange={field.onChange}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {ATTRIBUTE_TYPES.map((item) => (
                    <Select.Item key={item} value={item}>
                      {t(`qticaret.attributeTemplates.types.${item}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          )}
        />
      </div>
      {type === "number" && text(`${base}.unit`, t("qticaret.attributeTemplates.definition.unit"))}
      {isSelectType(type) && (
        <div className="flex flex-col gap-2">
          <Label size="xsmall" weight="plus">
            {t("qticaret.attributeTemplates.definition.options")}
          </Label>
          {options.fields.map((option, optionIndex) => (
            <div key={option.id} className="flex items-center gap-2">
              <Controller
                control={control}
                name={`${base}.options.${optionIndex}.label`}
                render={({ field }) => (
                  <Input
                    size="small"
                    aria-label={t("qticaret.attributeTemplates.definition.optionLabel")}
                    placeholder={t("qticaret.attributeTemplates.definition.optionLabel")}
                    {...field}
                    onBlur={() => {
                      field.onBlur()
                      // A value from the label when none was typed: slug-like, as the API wants
                      const valuePath = `${base}.options.${optionIndex}.value` as const
                      if (getValues(valuePath) === "") {
                        setValue(valuePath, toSlug(field.value, 100).replace(/-/g, "_"))
                      }
                    }}
                  />
                )}
              />
              <Controller
                control={control}
                name={`${base}.options.${optionIndex}.value`}
                render={({ field }) => (
                  <Input
                    size="small"
                    aria-label={t("qticaret.attributeTemplates.definition.optionValue")}
                    placeholder={t("qticaret.attributeTemplates.definition.optionValue")}
                    {...field}
                  />
                )}
              />
              <Button
                type="button"
                size="small"
                variant="transparent"
                onClick={() => {
                  options.remove(optionIndex)
                }}
              >
                {t("qticaret.common.remove")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="small"
            variant="secondary"
            className="w-fit"
            onClick={() => {
              options.append({ value: "", label: "" })
            }}
          >
            {t("qticaret.attributeTemplates.definition.addOption")}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        {flag(`${base}.is_required`, t("qticaret.attributeTemplates.definition.required"))}
        {flag(`${base}.is_filterable`, t("qticaret.attributeTemplates.definition.filterable"))}
        {flag(`${base}.is_seo_highlight`, t("qticaret.attributeTemplates.definition.seoHighlight"))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Controller
          control={control}
          name={`${base}.scope`}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <Label size="xsmall" weight="plus">
                {t("qticaret.attributeTemplates.definition.scope")}
              </Label>
              <Select size="small" value={field.value} onValueChange={field.onChange}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {(["product", "variant"] as const).map((item) => (
                    <Select.Item key={item} value={item}>
                      {t(`qticaret.attributeTemplates.scopes.${item}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          )}
        />
        {scope === "variant" &&
          text(`${base}.option_title`, t("qticaret.attributeTemplates.definition.optionTitle"))}
        {scope === "variant" && (
          <Controller
            control={control}
            name={`${base}.varies_by`}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <Label size="xsmall" weight="plus">
                  {t("qticaret.attributeTemplates.definition.variesBy")}
                </Label>
                <Select
                  size="small"
                  value={field.value === "" ? NONE : field.value}
                  onValueChange={(value) => {
                    field.onChange(value === NONE ? "" : value)
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={NONE}>
                      {t("qticaret.attributeTemplates.variesBy.none")}
                    </Select.Item>
                    {VARIES_BY.map((item) => (
                      <Select.Item key={item} value={item}>
                        {t(`qticaret.attributeTemplates.variesBy.${item}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
          />
        )}
      </div>
      <Button
        type="button"
        size="small"
        variant="transparent"
        className="text-ui-fg-error w-fit"
        onClick={onRemove}
      >
        {t("qticaret.attributeTemplates.definition.remove")}
      </Button>
    </fieldset>
  )
}
