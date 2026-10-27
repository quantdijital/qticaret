import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, validationErrorFromZod } from "../../../lib/errors"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type {
  AttributeInputValue,
  AttributeOption,
  DefinitionShape,
} from "../../../modules/product-attributes/validation"
import { productValuesSchema } from "../../../modules/product-attributes/validation"
import { fromColumns, sameColumns, toColumns } from "../../../modules/product-attributes/values"
import type { StoredColumns, ValueColumns } from "../../../modules/product-attributes/values"

export interface UpsertProductAttributesInput {
  product_id: string
  template_id: string | null
  /** Keys to set; null clears one; keys left out keep their value. */
  values?: Record<string, AttributeInputValue> | undefined
  /** Required to change or remove the template of a product that has values: they go. */
  confirm_template_change?: boolean | undefined
}

export interface ProductAttributesPlan {
  product_id: string
  create: (ValueColumns & { definition_id: string })[]
  update: (ValueColumns & { id: string; previous: ValueColumns })[]
  remove: string[]
  template: { from: string | null; to: string | null }
}

interface LinkedValue extends StoredColumns {
  id: string
  definition: { id: string; key: string; type: DefinitionShape["type"] } | null
}

const columnsOf = (row: StoredColumns): ValueColumns => ({
  value_text: row.value_text ?? null,
  value_number:
    row.value_number === null || row.value_number === undefined ? null : Number(row.value_number),
  value_boolean: row.value_boolean ?? null,
  value_options: Array.isArray(row.value_options) ? (row.value_options as string[]) : null,
})

const invalidValues = (error: unknown): unknown =>
  validationErrorFromZod(error, "product_attributes.value_invalid", { defaultField: "values" })

/**
 * Reads the product's template and values, checks the new values against
 * the template's definitions and works out what to create, change and
 * remove. A new template drops the old template's values.
 */
export const planProductAttributesStep = createStep(
  "product-attributes-plan-values",
  async (input: UpsertProductAttributesInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "attribute_template.id",
        "attribute_values.*",
        "attribute_values.definition.id",
        "attribute_values.definition.key",
        "attribute_values.definition.type",
      ],
      filters: { id: input.product_id },
    })
    const product = data[0] as
      | { attribute_template?: { id: string } | null; attribute_values?: (LinkedValue | null)[] }
      | undefined
    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "product_attributes.product_unknown")
    }
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    const definitions: (DefinitionShape & { id: string })[] = input.template_id
      ? (
          await service.retrieveAttributeTemplate(input.template_id, { relations: ["definitions"] })
        ).definitions.map((definition) => ({
          id: definition.id,
          key: definition.key,
          type: definition.type,
          scope: definition.scope,
          is_required: definition.is_required,
          options: definition.options as AttributeOption[] | null,
        }))
      : []
    const from = product.attribute_template?.id ?? null
    const linked = (product.attribute_values ?? []).filter(
      (value): value is LinkedValue => value !== null
    )
    if (from !== input.template_id && linked.length > 0 && !input.confirm_template_change) {
      throw new ConflictError("product_attributes.template_change_unconfirmed")
    }
    // Values kept are those of the current template's product attributes; any
    // other linked value (another template's, or one whose definition was
    // removed) goes
    const productDefinitions = new Set(
      definitions.filter((item) => item.scope === "product").map((item) => item.id)
    )
    const kept =
      from === input.template_id
        ? linked.filter((value) => value.definition && productDefinitions.has(value.definition.id))
        : []
    const current = Object.fromEntries(
      kept.map((value) => [
        value.definition?.key ?? "",
        fromColumns(value.definition?.type ?? "text", value),
      ])
    )
    const parsed = productValuesSchema(definitions).safeParse({
      ...current,
      ...(input.values ?? {}),
    })
    if (!parsed.success) {
      throw invalidValues(parsed.error)
    }
    const desired = parsed.data as Record<string, AttributeInputValue | undefined>
    const plan: ProductAttributesPlan = {
      product_id: input.product_id,
      create: [],
      update: [],
      remove: linked.filter((value) => !kept.includes(value)).map((value) => value.id),
      template: { from, to: input.template_id },
    }
    for (const definition of definitions.filter((item) => item.scope === "product")) {
      const existing = kept.find((value) => value.definition?.id === definition.id)
      // Own keys only: a missing key must not read the prototype
      const wanted = Object.hasOwn(desired, definition.key) ? desired[definition.key] : undefined
      if (wanted === undefined || wanted === null) {
        if (existing) {
          plan.remove.push(existing.id)
        }
        continue
      }
      const columns = toColumns(definition.type, wanted)
      if (!existing) {
        plan.create.push({ ...columns, definition_id: definition.id })
      } else if (!sameColumns(columns, columnsOf(existing))) {
        plan.update.push({ ...columns, id: existing.id, previous: columnsOf(existing) })
      }
    }
    return new StepResponse(plan)
  }
)
