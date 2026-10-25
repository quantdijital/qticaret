import type {
  AttributeDefinition,
  AttributeOption,
  AttributeTemplate,
  AttributeType,
} from "../../../lib/attributes"
import { isSelectType } from "../../../lib/attributes"

/** The template editor's form values and their mapping to and from the API. */

export interface DefinitionForm {
  id?: string | undefined
  key: string
  label: string
  type: AttributeType
  unit: string
  options: AttributeOption[]
  is_required: boolean
  is_filterable: boolean
  is_seo_highlight: boolean
  scope: "product" | "variant"
  option_title: string
  /** "" for none */
  varies_by: string
}

export interface TemplateForm {
  name: string
  handle: string
  description: string
  definitions: DefinitionForm[]
}

export const emptyDefinition = (): DefinitionForm => ({
  key: "",
  label: "",
  type: "text",
  unit: "",
  options: [],
  is_required: false,
  is_filterable: false,
  is_seo_highlight: false,
  scope: "product",
  option_title: "",
  varies_by: "",
})

const definitionForm = (definition: AttributeDefinition): DefinitionForm => ({
  id: definition.id,
  key: definition.key,
  label: definition.label,
  type: definition.type,
  unit: definition.unit ?? "",
  options: definition.options ?? [],
  is_required: definition.is_required,
  is_filterable: definition.is_filterable,
  is_seo_highlight: definition.is_seo_highlight,
  scope: definition.scope,
  option_title: definition.option_title ?? "",
  varies_by: definition.varies_by ?? "",
})

export const templateForm = (template?: AttributeTemplate): TemplateForm => ({
  name: template?.name ?? "",
  handle: template?.handle ?? "",
  description: template?.description ?? "",
  definitions: [...(template?.definitions ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map(definitionForm),
})

const orNull = (text: string): string | null => (text.trim() === "" ? null : text.trim())

/** The definitions as the API takes them; list order becomes `rank`. */
export const definitionsApi = (definitions: DefinitionForm[]) =>
  definitions.map((definition, index) => {
    const variant = definition.scope === "variant"
    return {
      ...(definition.id ? { id: definition.id } : {}),
      key: definition.key.trim(),
      label: definition.label.trim(),
      type: definition.type,
      unit: orNull(definition.unit),
      options: isSelectType(definition.type) ? definition.options : null,
      rank: index,
      is_required: definition.is_required,
      is_filterable: definition.is_filterable,
      is_seo_highlight: definition.is_seo_highlight,
      scope: definition.scope,
      option_title: variant ? orNull(definition.option_title) : null,
      varies_by: variant ? orNull(definition.varies_by) : null,
    }
  })
