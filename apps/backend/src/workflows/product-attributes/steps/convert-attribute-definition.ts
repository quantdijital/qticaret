import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import ProductAttributeValuesLink from "../../../links/product-attribute-values"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import { planConversion } from "../../../modules/product-attributes/conversion"
import type { ConversionPair, StoredText } from "../../../modules/product-attributes/conversion"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type { AttributeDefinitionRecord } from "../../../modules/product-attributes/service"
import { aliasesOf, definitionInput } from "../../../modules/product-attributes/validation"
import type { AttributeOption } from "../../../modules/product-attributes/validation"

export interface ConvertAttributeDefinitionInput {
  template_id: string
  definition_id: string
  options: AttributeOption[]
  /** Every stored text and what it becomes: an option's value, or `null` to clear it. */
  mapping: ConversionPair[]
  /** Left out: as it was. */
  is_filterable?: boolean | undefined
}

export interface ConvertedDefinition {
  /** Every product whose value changed or went: search and listings read it again. */
  product_ids: string[]
  /** The cleared values' links to their products, to dismiss. */
  cleared: { product_id: string; attribute_value_id: string }[]
}

interface Undo {
  definition: { id: string; type: "text"; options: null; is_filterable: boolean }
  rewritten: { id: string; value_text: string }[]
  clearedIds: string[]
}

type Service = ProductAttributesModuleService

// Writes and reads are split so a field many products use stays under
// Postgres's bind parameter limit
const CHUNK = 1_000
const chunks = <T>(items: T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, index) =>
    items.slice(index * CHUNK, (index + 1) * CHUNK)
  )

async function storedTexts(service: Service, definitionId: string): Promise<StoredText[]> {
  const values: StoredText[] = []
  for (let skip = 0; ; skip += CHUNK) {
    const page = await service.listAttributeValues(
      { definition_id: definitionId },
      { select: ["id", "value_text"], skip, take: CHUNK, order: { id: "ASC" } }
    )
    values.push(...page.map(({ id, value_text }) => ({ id, value_text })))
    if (page.length < CHUNK) {
      return values
    }
  }
}

/** Each value's product, from the link table. */
async function productsOf(container: Pick<MedusaContainer, "resolve">, valueIds: string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rows: { product_id: string; attribute_value_id: string }[] = []
  for (const ids of chunks(valueIds)) {
    const { data } = await query.graph({
      entity: ProductAttributeValuesLink.entryPoint,
      fields: ["product_id", "attribute_value_id"],
      filters: { attribute_value_id: ids },
    })
    rows.push(...(data as typeof rows))
  }
  return rows
}

/** The definition as a single choice, through the template's own rules (a reserved key, a hidden filter). */
function checkedChoice(
  definition: AttributeDefinitionRecord,
  input: ConvertAttributeDefinitionInput
): void {
  const parsed = definitionInput.safeParse({
    key: definition.key,
    label: definition.label,
    type: "select",
    unit: definition.unit,
    options: input.options,
    is_required: definition.is_required,
    is_filterable: input.is_filterable ?? definition.is_filterable,
    is_seo_highlight: definition.is_seo_highlight,
    is_public: definition.is_public,
    scope: "product",
    aliases: aliasesOf(definition.aliases),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new ValidationError(issue?.message ?? "product_attributes.value_invalid", {
      field: String(issue?.path[0] ?? "options"),
    })
  }
}

async function undoConversion(service: Service, undo: Undo): Promise<void> {
  for (const ids of chunks(undo.clearedIds)) {
    await service.restoreAttributeValues(ids)
  }
  for (const rows of chunks(undo.rewritten)) {
    await service.updateAttributeValues(rows)
  }
  await service.updateAttributeDefinitions(undo.definition)
}

/**
 * A product-level text attribute with values becomes a single choice
 * (adr/0013 Ek 2026-11-05): its options set, each stored text replaced by
 * its option's value, the ones mapped to nothing cleared. Refused before
 * anything is written when a stored text has no mapping; undone in full
 * when it fails half way or a later step does.
 */
export const convertAttributeDefinitionStep = createStep(
  "product-attributes-convert-definition",
  async (input: ConvertAttributeDefinitionInput, { container }) => {
    const service = container.resolve<Service>(PRODUCT_ATTRIBUTES_MODULE)
    const [definition] = await service.listAttributeDefinitions(
      { id: input.definition_id, template_id: input.template_id },
      { take: 1 }
    )
    if (!definition) {
      throw new ValidationError("product_attributes.definition_unknown", {
        field: "definition_id",
      })
    }
    if (definition.type !== "text" || definition.scope !== "product") {
      throw new ConflictError("product_attributes.convert_text_only")
    }
    checkedChoice(definition, input)
    const plan = planConversion(
      await storedTexts(service, definition.id),
      input.mapping,
      input.options,
      definition.is_required
    )
    const links = await productsOf(
      container,
      [...plan.rewrite, ...plan.clear].map((value) => value.id)
    )
    const undo: Undo = {
      definition: {
        id: definition.id,
        type: "text",
        options: null,
        is_filterable: definition.is_filterable,
      },
      rewritten: [],
      clearedIds: [],
    }
    try {
      await service.updateAttributeDefinitions({
        id: definition.id,
        type: "select",
        // A json column is typed as an object; it holds the `{ value, label }[]` list
        options: input.options as unknown as Record<string, unknown>,
        ...(input.is_filterable === undefined ? {} : { is_filterable: input.is_filterable }),
      })
      for (const rows of chunks(plan.rewrite)) {
        await service.updateAttributeValues(rows.map(({ id, to }) => ({ id, value_text: to })))
        undo.rewritten.push(...rows.map(({ id, from }) => ({ id, value_text: from })))
      }
      const clearedIds = plan.clear.map((value) => value.id)
      for (const ids of chunks(clearedIds)) {
        await service.softDeleteAttributeValues(ids)
        undo.clearedIds.push(...ids)
      }
    } catch (error) {
      await undoConversion(service, undo)
      throw error
    }
    const clearedIds = new Set(undo.clearedIds)
    const converted: ConvertedDefinition = {
      product_ids: [...new Set(links.map((link) => link.product_id))],
      cleared: links.filter((link) => clearedIds.has(link.attribute_value_id)),
    }
    return new StepResponse(converted, undo)
  },
  async (undo: Undo | undefined, { container }) => {
    if (undo) {
      await undoConversion(container.resolve<Service>(PRODUCT_ATTRIBUTES_MODULE), undo)
    }
  }
)
