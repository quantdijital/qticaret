import { toSlug } from "@/lib/slug"
import { groupsApi, groupsForm } from "./groups"
import type { GroupForm } from "./groups"
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
  /** The spec table section's key; "" for none. */
  group: string
  /** Other names the facts in descriptions call it by. */
  aliases: string[]
}

export interface TemplateForm {
  name: string
  handle: string
  description: string
  groups: GroupForm[]
  definitions: DefinitionForm[]
  /** Add-on templates its products get, in order (adr/0052 Ek 2026-11-23); saved on their own. */
  addonTemplateIds: string[]
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
  group: "",
  aliases: [],
})

const definitionForm = (
  definition: AttributeDefinition,
  groups: ReadonlySet<string>
): DefinitionForm => ({
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
  group: definition.group && groups.has(definition.group) ? definition.group : "",
  aliases: definition.aliases ?? [],
})

export const templateForm = (template?: AttributeTemplate | null): TemplateForm => {
  const groups = groupsForm(template?.groups)
  const keys = new Set(groups.map((group) => group.key))
  return {
    name: template?.name ?? "",
    handle: template?.handle ?? "",
    description: template?.description ?? "",
    groups,
    definitions: [...(template?.definitions ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .map((definition) => definitionForm(definition, keys)),
    addonTemplateIds: [...(template?.addon_template_ids ?? [])],
  }
}

/** Whether the carried add-on templates changed: they are saved by their own route. */
export const carriedChanged = (saved: AttributeTemplate | null, form: TemplateForm): boolean =>
  JSON.stringify(saved?.addon_template_ids ?? []) !== JSON.stringify(form.addonTemplateIds)

const orNull = (text: string): string | null => (text.trim() === "" ? null : text.trim())

/** A definition's key from its label: snake case, a letter first (the server's rule). */
export function keyFromLabel(label: string): string {
  const key = toSlug(label).replace(/-/g, "_").slice(0, 64)
  return /^[a-z]/.test(key) ? key : key ? `a_${key}`.slice(0, 64) : ""
}

/** An option's value from its label: the slug facet URLs use (F3.17). */
export const optionValue = (label: string): string => toSlug(label).slice(0, 100)

/** A field's options with the ones just added from a product that the saved group lacks yet. */
export const withAdded = (
  options: readonly AttributeOption[],
  added: readonly AttributeOption[]
): AttributeOption[] => [
  ...options,
  ...added.filter((each) => !options.some((option) => option.value === each.value)),
]

/**
 * The definitions as the API takes them; list order becomes `rank`. Given
 * the template's section keys, each names its section (or none); without
 * them `group` is left out and the server keeps what it has.
 */
export const definitionsApi = (definitions: DefinitionForm[], groups?: ReadonlySet<string>) =>
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
      ...(groups ? { group: groups.has(definition.group) ? definition.group : null } : {}),
      // A product option is named by its option title
      aliases: variant ? [] : definition.aliases,
    }
  })

/**
 * The template as the API takes it. Its sections and each field's section
 * go only when it has or had sections: a template without saves as before.
 */
export function templateBody(form: TemplateForm, saved: AttributeTemplate | null) {
  const sections = form.groups.length > 0 || (saved?.groups?.length ?? 0) > 0
  const keys = new Set(form.groups.map((group) => group.key))
  return {
    name: form.name.trim(),
    description: orNull(form.description),
    ...(sections ? { groups: groupsApi(form.groups) } : {}),
    definitions: definitionsApi(form.definitions, sections ? keys : undefined),
  }
}

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
