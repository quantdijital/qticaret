import type { MedusaContainer } from "@medusajs/framework/types"
import { fieldNames, keyFor, labelKey } from "../../../lib/catalog/facts"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type { AttributeDefinitionRecord } from "../../../modules/product-attributes/service"
import {
  aliasesOf,
  definitionInput,
  groupsOf,
} from "../../../modules/product-attributes/validation"
import type {
  AttributeGroup,
  DefinitionInput,
} from "../../../modules/product-attributes/validation"
import { updateAttributeTemplateWorkflow } from "../templates"
import type { FactsAliasInput, FactsFieldInput } from "./input"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What the shop ticked in the preview, made in a template before the
 * products' values are written (adr/0013 Ek 2026-11-05): a label added as
 * a new field (in the section it was given, at the end of the list), or
 * kept as another name of a field the template has. Each goes through the
 * template's own update, with its checks and its undo; a field its rules
 * refuse, or a label a field already answers to, is left and named.
 */

const MAX_ALIASES = 20

export interface TemplateChange {
  template_id: string
  /** Keys of the fields added. */
  added: string[]
  /** `key: label` of the other names kept. */
  aliased: string[]
  /** Labels left: a field answers to them already, or the template's rules refused them. */
  left: string[]
}

/** A definition as the template's update takes it back, unchanged. */
const asInput = (definition: AttributeDefinitionRecord): DefinitionInput =>
  ({
    id: definition.id,
    key: definition.key,
    label: definition.label,
    type: definition.type,
    unit: definition.unit,
    options: definition.options,
    rank: definition.rank,
    is_required: definition.is_required,
    is_filterable: definition.is_filterable,
    is_seo_highlight: definition.is_seo_highlight,
    is_public: definition.is_public,
    scope: definition.scope,
    option_title: definition.option_title,
    varies_by: definition.varies_by,
    group: definition.group,
    aliases: aliasesOf(definition.aliases),
  }) as unknown as DefinitionInput

const isChoice = (type: string) => type === "select" || type === "multi_select"

/** The new field as a definition the template's rules accept, or none. */
function newDefinition(
  field: FactsFieldInput,
  key: string,
  rank: number,
  groups: readonly AttributeGroup[]
): DefinitionInput | null {
  const parsed = definitionInput.safeParse({
    key,
    label: field.label,
    type: field.type,
    unit: field.type === "number" || field.type === "text" ? (field.unit ?? null) : null,
    options: isChoice(field.type) ? (field.options ?? []) : null,
    rank,
    scope: "product",
    group: field.group && groups.some((group) => group.key === field.group) ? field.group : null,
  })
  return parsed.success ? parsed.data : null
}

/** The template's definitions with the ticked fields and names, and what came of each. */
export function changedDefinitions(
  definitions: readonly AttributeDefinitionRecord[],
  groups: readonly AttributeGroup[],
  fields: readonly FactsFieldInput[],
  aliases: readonly FactsAliasInput[]
): { definitions: DefinitionInput[]; change: Omit<TemplateChange, "template_id"> } {
  const inputs = definitions.map(asInput)
  const change = { added: [] as string[], aliased: [] as string[], left: [] as string[] }
  const groupName = (key: string | null | undefined) =>
    groups.find((group) => group.key === key)?.name ?? null
  const answers = (label: string) =>
    inputs.some((input) =>
      fieldNames(
        {
          ...input,
          unit: input.unit ?? null,
          options: input.options ?? null,
          scope: input.scope ?? "product",
        },
        groupName(input.group)
      ).includes(labelKey(label))
    )
  for (const alias of aliases) {
    const target = inputs.find((input) => input.key === alias.key && input.scope !== "variant")
    const names = target?.aliases ?? []
    if (!target || answers(alias.label) || names.length >= MAX_ALIASES) {
      change.left.push(alias.label)
      continue
    }
    target.aliases = [...names, alias.label]
    change.aliased.push(`${target.key}: ${alias.label}`)
  }
  const taken = new Set(inputs.map((input) => input.key))
  let rank = Math.max(-1, ...inputs.map((input) => input.rank ?? 0))
  for (const field of fields) {
    if (answers(field.label)) {
      change.left.push(field.label)
      continue
    }
    rank += 1
    const definition = newDefinition(field, keyFor(field.label, taken), rank, groups)
    if (!definition) {
      change.left.push(field.label)
      continue
    }
    inputs.push(definition)
    change.added.push(definition.key)
  }
  return { definitions: inputs, change }
}

/** Makes the ticked fields and names in their templates; a template with none is left alone. */
export async function applyTemplateChanges(
  container: Container,
  fields: readonly FactsFieldInput[],
  aliases: readonly FactsAliasInput[]
): Promise<TemplateChange[]> {
  const ids = [...new Set([...fields, ...aliases].map((each) => each.template_id))]
  const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
  const changes: TemplateChange[] = []
  for (const id of ids) {
    const [template] = await service.listAttributeTemplates({ id }, { relations: ["definitions"] })
    if (!template) {
      changes.push({
        template_id: id,
        added: [],
        aliased: [],
        left: [...fields, ...aliases]
          .filter((each) => each.template_id === id)
          .map((each) => each.label),
      })
      continue
    }
    const { definitions, change } = changedDefinitions(
      template.definitions,
      groupsOf(template.groups),
      fields.filter((each) => each.template_id === id),
      aliases.filter((each) => each.template_id === id)
    )
    if (change.added.length > 0 || change.aliased.length > 0) {
      await updateAttributeTemplateWorkflow(container as MedusaContainer).run({
        input: { id, definitions },
      })
    }
    changes.push({ template_id: id, ...change })
  }
  return changes
}
