import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { FactsProduct, MatchTemplate } from "../../../lib/catalog/facts"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type {
  AttributeInputValue,
  AttributeOption,
  AttributeType,
} from "../../../modules/product-attributes/validation"
import { aliasesOf, groupsOf } from "../../../modules/product-attributes/validation"
import { fromColumns } from "../../../modules/product-attributes/values"
import type { StoredColumns } from "../../../modules/product-attributes/values"

type Container = Pick<MedusaContainer, "resolve">

/** A template as the facts are matched to it, with its name. */
export type NamedTemplate = MatchTemplate & { name: string }

/** The shop's templates with their fields, sections and other names, by id. */
export async function readMatchTemplates(
  container: Container
): Promise<Map<string, NamedTemplate>> {
  const templates = await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .listAttributeTemplates({}, { relations: ["definitions"], take: null })
  return new Map(
    templates.map((template) => [
      template.id,
      {
        id: template.id,
        name: template.name,
        groups: groupsOf(template.groups),
        definitions: [...template.definitions]
          .sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key))
          .map((definition) => ({
            key: definition.key,
            label: definition.label,
            type: definition.type,
            unit: definition.unit,
            options: definition.options as AttributeOption[] | null,
            scope: definition.scope,
            group: definition.group,
            aliases: aliasesOf(definition.aliases),
            is_required: definition.is_required,
          })),
      },
    ])
  )
}

interface ProductRow {
  id: string
  title: string
  handle: string
  description: string | null
  product_extension?: { description_doc?: unknown } | null
  attribute_template?: { id: string } | null
  attribute_values?: (
    (StoredColumns & { definition?: { key: string; type: AttributeType } | null }) | null
  )[]
}

export type ReadProduct = Omit<FactsProduct, "template"> & {
  handle: string
  template: NamedTemplate | null
  template_id: string | null
}

/** The products named (those gone are left out), each with its template from `templates`. */
export async function readFactsProducts(
  container: Container,
  ids: readonly string[],
  templates: ReadonlyMap<string, NamedTemplate>
): Promise<ReadProduct[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "description",
      "product_extension.description_doc",
      "attribute_template.id",
      "attribute_values.*",
      "attribute_values.definition.key",
      "attribute_values.definition.type",
    ],
    filters: { id: [...ids] },
  })
  return (data as unknown as ProductRow[]).map((product) => {
    const templateId = product.attribute_template?.id ?? null
    const values: Record<string, AttributeInputValue> = {}
    for (const value of product.attribute_values ?? []) {
      if (value?.definition) {
        values[value.definition.key] = fromColumns(value.definition.type, value)
      }
    }
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      doc: product.product_extension?.description_doc ?? null,
      description: product.description,
      template: templateId ? (templates.get(templateId) ?? null) : null,
      template_id: templateId,
      values,
    }
  })
}
