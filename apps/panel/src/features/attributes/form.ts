import { toSlug } from "@/lib/slug"
import { isSelectType } from "./types"
import type {
  AttributeDefinition,
  AttributeOption,
  AttributeTemplate,
  AttributeType,
} from "./types"

/** The template editor's values and their mapping to and from the API. */

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
  is_public: boolean
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
  is_public: true,
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
  is_public: definition.is_public ?? true,
  scope: definition.scope,
  option_title: definition.option_title ?? "",
  varies_by: definition.varies_by ?? "",
})

export const templateForm = (template?: AttributeTemplate | null): TemplateForm => ({
  name: template?.name ?? "",
  handle: template?.handle ?? "",
  description: template?.description ?? "",
  definitions: [...(template?.definitions ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map(definitionForm),
})

const orNull = (text: string): string | null => (text.trim() === "" ? null : text.trim())

/** A definition's key from its label: snake case, a letter first (the server's rule). */
export function keyFromLabel(label: string): string {
  const key = toSlug(label).replace(/-/g, "_").slice(0, 64)
  return /^[a-z]/.test(key) ? key : key ? `a_${key}`.slice(0, 64) : ""
}

/** An option's value from its label: the slug facet URLs use (F3.17). */
export const optionValue = (label: string): string => toSlug(label).slice(0, 100)

/** The definitions as the API takes them; list order becomes `rank`. */
export const definitionsApi = (definitions: DefinitionForm[]) =>
  definitions.map((definition, index) => {
    const variant = definition.scope === "variant"
    // A product option is always shown; a hidden attribute is no filter or title word
    const shown = variant || definition.is_public
    return {
      ...(definition.id ? { id: definition.id } : {}),
      key: definition.key.trim() || keyFromLabel(definition.label),
      label: definition.label.trim(),
      type: definition.type,
      unit: orNull(definition.unit),
      options: isSelectType(definition.type) ? definition.options : null,
      rank: index,
      is_required: definition.is_required,
      is_filterable: shown && definition.is_filterable,
      is_seo_highlight: shown && definition.is_seo_highlight,
      is_public: shown,
      scope: definition.scope,
      option_title: variant ? orNull(definition.option_title) : null,
      varies_by: variant ? orNull(definition.varies_by) : null,
    }
  })

/** Saved definitions the form no longer holds: their values on products go too. */
export const removedDefinitions = (
  saved: AttributeTemplate | null,
  form: TemplateForm
): AttributeDefinition[] => {
  const kept = new Set(
    form.definitions.flatMap((definition) => (definition.id ? [definition.id] : []))
  )
  return (saved?.definitions ?? []).filter((definition) => !kept.has(definition.id))
}
