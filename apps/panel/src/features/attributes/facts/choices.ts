import { optionValue } from "@/features/attributes/form"
import type { AttributeOption, AttributeType } from "@/features/attributes/types"
import { isSelectType } from "@/features/attributes/types"
import type { FactsPreview, FieldSuggestion } from "./types"

/**
 * What the shop decides in the facts preview (adr/0013 Ek 2026-11-05),
 * per label no field names: leave it, add it as a field (of a kind, in a
 * section), or keep it as another name of a field the template has. And
 * the run's input from those choices. Nothing is decided for the shop:
 * every label starts left.
 */

export interface LabelChoice {
  /** Add it to the template as a field of its own. */
  add: boolean
  type: AttributeType
  /** The section's key; "" for none. */
  group: string
  /** A field it becomes another name of; "" for none. */
  aliasOf: string
}

export type Choices = Readonly<Record<string, LabelChoice>>

export const choiceKey = (templateId: string, name: string): string => `${templateId}/${name}`

export const initialChoice = (suggestion: FieldSuggestion): LabelChoice => ({
  add: false,
  type: suggestion.type,
  group: suggestion.group ?? "",
  aliasOf: "",
})

export const choiceOf = (
  choices: Choices,
  templateId: string,
  suggestion: FieldSuggestion
): LabelChoice => choices[choiceKey(templateId, suggestion.name)] ?? initialChoice(suggestion)

/** A choice field's options: the suggestion's, or one per value the products wrote. */
export function optionsFor(suggestion: FieldSuggestion): AttributeOption[] {
  if (suggestion.options && suggestion.options.length > 0) {
    return suggestion.options
  }
  const options: AttributeOption[] = []
  for (const label of suggestion.values) {
    const value = optionValue(label)
    if (value && !options.some((option) => option.value === value)) {
      options.push({ value, label: label.slice(0, 200) })
    }
  }
  return options.slice(0, 200)
}

export interface FactsRunInput {
  product_ids: string[]
  template_id?: string
  overwrite: boolean
  fields: {
    template_id: string
    label: string
    type: AttributeType
    unit: string | null
    options: AttributeOption[] | null
    group: string | null
  }[]
  aliases: { template_id: string; key: string; label: string }[]
}

/** The run's input: the products, the template for those without one, the fields and names ticked. */
export function runInput(
  productIds: readonly string[],
  preview: FactsPreview,
  choices: Choices,
  options: { overwrite: boolean; templateId: string | null }
): FactsRunInput {
  const input: FactsRunInput = {
    product_ids: [...productIds],
    ...(options.templateId ? { template_id: options.templateId } : {}),
    overwrite: options.overwrite,
    fields: [],
    aliases: [],
  }
  for (const { template_id, fields } of preview.suggestions) {
    for (const suggestion of fields) {
      const choice = choiceOf(choices, template_id, suggestion)
      if (choice.add) {
        input.fields.push({
          template_id,
          label: suggestion.label,
          type: choice.type,
          unit: choice.type === "number" ? suggestion.unit : null,
          options: isSelectType(choice.type) ? optionsFor(suggestion) : null,
          group: choice.group || null,
        })
      } else if (choice.aliasOf) {
        input.aliases.push({ template_id, key: choice.aliasOf, label: suggestion.label })
      }
    }
  }
  return input
}

/** Values the run writes as the preview stands: each product's fields once. */
export function valuesToWrite(preview: FactsPreview, overwrite: boolean): number {
  return preview.products.reduce((sum, product) => {
    const fields = new Set(
      product.rows
        .filter((row) => row.status === "ready" || (overwrite && row.status === "filled"))
        .flatMap((row) => (row.field ? [row.field] : []))
    )
    return sum + fields.size
  }, 0)
}

/** Whether the run has anything to do: values to write, or a field or name to add. */
export const hasWork = (preview: FactsPreview, input: FactsRunInput): boolean =>
  valuesToWrite(preview, input.overwrite) > 0 || input.fields.length > 0 || input.aliases.length > 0
