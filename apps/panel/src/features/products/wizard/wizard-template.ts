import { useQuery } from "@tanstack/react-query"
import { useFormContext, useWatch } from "react-hook-form"
import { templatesQuery } from "@/features/attributes/api"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import type { WizardValues } from "./schema"

/** A template's product attributes in its order; a variant one is the product's options. */
export const productDefinitions = (template: AttributeTemplate | null): AttributeDefinition[] =>
  [...(template?.definitions ?? [])]
    .filter((definition) => definition.scope === "product")
    .sort((a, b) => a.rank - b.rank)

/** The template the new product form names, from the shop's templates; null for none. */
export function useWizardTemplate(): AttributeTemplate | null {
  const { control } = useFormContext<WizardValues>()
  const templateId = useWatch({ control, name: "template_id" })
  const templates = useQuery(templatesQuery())
  return (templates.data ?? []).find((each) => each.id === templateId) ?? null
}
