import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type { AttributeDefinitionRecord } from "../../../modules/product-attributes/service"
import { duplicateKeys } from "../../../modules/product-attributes/validation"
import type {
  AttributeOption,
  DefinitionInput,
} from "../../../modules/product-attributes/validation"
import { attributeConflict, definitionRow } from "./create-attribute-template"

export interface UpdateAttributeTemplateInput {
  id: string
  name?: string | undefined
  description?: string | null | undefined
  /** The full list: entries with an `id` change that definition, others are new, missing ones go. */
  definitions?: DefinitionInput[] | undefined
  /** Required to remove definitions that products have values for; those values go too. */
  confirm_delete_values?: boolean | undefined
}

interface Undo {
  template: { id: string; name: string; description: string | null }
  definitions: AttributeDefinitionRecord[]
  createdIds: string[]
  removedDefinitionIds: string[]
  removedValueIds: string[]
}

// Writes are split so a definition many products use stays under
// Postgres's bind parameter limit
const CHUNK = 1_000
const chunks = <T>(items: T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, index) =>
    items.slice(index * CHUNK, (index + 1) * CHUNK)
  )

const optionValues = (options: unknown): string[] =>
  ((options ?? []) as AttributeOption[]).map((option) => option.value)

type Service = ProductAttributesModuleService

const hasValues = async (service: Service, definitionId: string): Promise<boolean> =>
  (await service.listAttributeValues({ definition_id: definitionId }, { select: ["id"], take: 1 }))
    .length > 0

// Whether any value of the definition uses one of `dropped`; multiple choice
// is read page by page, single choice asked directly
async function usesOption(
  service: Service,
  definition: AttributeDefinitionRecord,
  dropped: string[]
): Promise<boolean> {
  if (definition.type === "select") {
    const found = await service.listAttributeValues(
      { definition_id: definition.id, value_text: dropped },
      { select: ["id"], take: 1 }
    )
    return found.length > 0
  }
  for (let skip = 0; ; skip += CHUNK) {
    const page = await service.listAttributeValues(
      { definition_id: definition.id },
      { select: ["id", "value_options"], skip, take: CHUNK, order: { id: "ASC" } }
    )
    if (
      page.some((value) =>
        ((value.value_options ?? []) as unknown as string[]).some((item) => dropped.includes(item))
      )
    ) {
      return true
    }
    if (page.length < CHUNK) {
      return false
    }
  }
}

async function valueIdsOf(service: Service, definitionIds: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const definitionId of definitionIds) {
    for (let skip = 0; ; skip += CHUNK) {
      const page = await service.listAttributeValues(
        { definition_id: definitionId },
        { select: ["id"], skip, take: CHUNK, order: { id: "ASC" } }
      )
      ids.push(...page.map((value) => value.id))
      if (page.length < CHUNK) {
        break
      }
    }
  }
  return ids
}

/**
 * The definitions a template update removes, after refusing changes that
 * would break products' values (adr/0013): a type, scope, key or unit change
 * or a dropped option still in use, and a removal without confirmation.
 */
async function checkChanges(
  service: Service,
  input: UpdateAttributeTemplateInput & { definitions: DefinitionInput[] },
  existing: AttributeDefinitionRecord[]
): Promise<AttributeDefinitionRecord[]> {
  if (duplicateKeys(input.definitions).length > 0) {
    throw new ValidationError("product_attributes.key_taken", { field: "definitions" })
  }
  const byId = new Map(existing.map((definition) => [definition.id, definition]))
  for (const definition of input.definitions) {
    const previous = definition.id === undefined ? undefined : byId.get(definition.id)
    if (definition.id !== undefined && !previous) {
      throw new ValidationError("product_attributes.definition_unknown", { field: "definitions" })
    }
    if (!previous || !(await hasValues(service, previous.id))) {
      continue
    }
    if (previous.type !== definition.type || previous.scope !== (definition.scope ?? "product")) {
      throw new ConflictError("product_attributes.type_locked")
    }
    // A new key changes facet URLs and title tokens; a new unit changes what stored numbers mean
    if (previous.key !== definition.key || (previous.unit ?? null) !== (definition.unit ?? null)) {
      throw new ConflictError("product_attributes.definition_locked")
    }
    const kept = optionValues(definition.options)
    const dropped = optionValues(previous.options).filter((value) => !kept.includes(value))
    if (dropped.length > 0 && (await usesOption(service, previous, dropped))) {
      throw new ConflictError("product_attributes.option_in_use")
    }
  }
  const keptIds = new Set(input.definitions.map((definition) => definition.id))
  const removed = existing.filter((definition) => !keptIds.has(definition.id))
  if (!input.confirm_delete_values) {
    for (const definition of removed) {
      if (await hasValues(service, definition.id)) {
        throw new ConflictError("product_attributes.values_exist")
      }
    }
  }
  return removed
}

async function applyDefinitions(
  service: Service,
  input: UpdateAttributeTemplateInput & { definitions: DefinitionInput[] },
  existing: AttributeDefinitionRecord[],
  undo: Undo
): Promise<void> {
  const removed = await checkChanges(service, input, existing)
  // Removals first, so a key removed and added again in one save is free
  undo.removedValueIds = await valueIdsOf(
    service,
    removed.map((definition) => definition.id)
  )
  for (const ids of chunks(undo.removedValueIds)) {
    await service.softDeleteAttributeValues(ids)
  }
  undo.removedDefinitionIds = removed.map((definition) => definition.id)
  if (undo.removedDefinitionIds.length > 0) {
    await service.softDeleteAttributeDefinitions(undo.removedDefinitionIds)
  }
  const changed = input.definitions.flatMap((definition) =>
    definition.id === undefined
      ? []
      : [{ ...definitionRow(definition, input.id), id: definition.id }]
  )
  if (changed.length > 0) {
    await service.updateAttributeDefinitions(changed)
  }
  const added = input.definitions.filter((definition) => definition.id === undefined)
  if (added.length > 0) {
    const created = await service.createAttributeDefinitions(
      added.map((definition) => definitionRow(definition, input.id))
    )
    undo.createdIds = created.map((definition) => definition.id)
  }
}

export const updateAttributeTemplateStep = createStep(
  "product-attributes-update-template",
  async (input: UpdateAttributeTemplateInput, { container }) => {
    const service = container.resolve<Service>(PRODUCT_ATTRIBUTES_MODULE)
    const template = await service.retrieveAttributeTemplate(input.id, {
      relations: ["definitions"],
    })
    const undo: Undo = {
      template: { id: template.id, name: template.name, description: template.description },
      definitions: template.definitions.map((definition) => ({ ...definition })),
      createdIds: [],
      removedDefinitionIds: [],
      removedValueIds: [],
    }
    try {
      await service.updateAttributeTemplates({
        id: input.id,
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
      })
      if (input.definitions) {
        await applyDefinitions(
          service,
          { ...input, definitions: input.definitions },
          template.definitions,
          undo
        )
      }
    } catch (error) {
      await undoUpdate(service, undo)
      throw attributeConflict(error)
    }
    return new StepResponse({ id: input.id }, undo)
  },
  async (undo: Undo | undefined, { container }) => {
    if (undo) {
      await undoUpdate(container.resolve<Service>(PRODUCT_ATTRIBUTES_MODULE), undo)
    }
  }
)

async function undoUpdate(service: Service, undo: Undo): Promise<void> {
  if (undo.createdIds.length > 0) {
    await service.deleteAttributeDefinitions(undo.createdIds)
  }
  if (undo.removedDefinitionIds.length > 0) {
    await service.restoreAttributeDefinitions(undo.removedDefinitionIds)
  }
  for (const ids of chunks(undo.removedValueIds)) {
    await service.restoreAttributeValues(ids)
  }
  if (undo.definitions.length > 0) {
    await service.updateAttributeDefinitions(
      undo.definitions.map((definition) => ({
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
      }))
    )
  }
  await service.updateAttributeTemplates(undo.template)
}
