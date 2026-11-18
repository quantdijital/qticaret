import { useQuery } from "@tanstack/react-query"
import { useFormContext, useWatch } from "react-hook-form"
import { templatesQuery } from "@/features/attributes/api"
import type {
  AttributeDefinition,
  AttributeTemplate,
  AttributeValue,
} from "@/features/attributes/types"
import type { WizardValues } from "./schema"

/** A template's product attributes in its order; a variant one is the product's options. */
export const productDefinitions = (template: AttributeTemplate | null): AttributeDefinition[] =>
  [...(template?.definitions ?? [])]
    .filter((definition) => definition.scope === "product")
    .sort((a, b) => a.rank - b.rank)

// A field left empty: nothing typed, picked or ticked
const isEmpty = (value: AttributeValue | undefined) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0)

/**
 * The template's required product attributes left empty, by key, so the
 * form stops before the product is created. A yes/no one is never empty:
 * its switch reads "no" until turned (`withRequiredSwitches`).
 */
export const missingRequired = (
  template: AttributeTemplate | null,
  values: Record<string, AttributeValue>
): string[] =>
  productDefinitions(template)
    .filter(
      (definition) =>
        definition.is_required && definition.type !== "boolean" && isEmpty(values[definition.key])
    )
    .map((definition) => definition.key)

/** The values with each required yes/no attribute never turned as "no", as its switch shows. */
export const withRequiredSwitches = (
  template: AttributeTemplate | null,
  values: Record<string, AttributeValue>
): Record<string, AttributeValue> => ({
  ...Object.fromEntries(
    productDefinitions(template)
      .filter((definition) => definition.is_required && definition.type === "boolean")
      .map((definition) => [definition.key, false])
  ),
  ...values,
})

/** The template the new product form names, from the shop's templates; null for none. */
export function useWizardTemplate(): AttributeTemplate | null {
  const { control } = useFormContext<WizardValues>()
  const templateId = useWatch({ control, name: "template_id" })
  const templates = useQuery(templatesQuery())
  return (templates.data ?? []).find((each) => each.id === templateId) ?? null
}
