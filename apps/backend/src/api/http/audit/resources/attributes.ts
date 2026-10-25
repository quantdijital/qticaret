import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../../modules/product-attributes/service"
import { readProductAttributes } from "../../../admin/products/[id]/attributes/read"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Product attributes (adr/0011, adr/0013), read from the database: a
 * product's template and one `value.<key>` per attribute; a template's
 * attributes as `definition.<key>` → type, label, unit, options, scope.
 */

async function productSnapshot(scope: Resolver, productId: string): Promise<Snapshot> {
  try {
    const { template, values } = await readProductAttributes(
      scope as unknown as MedusaContainer,
      productId
    )
    return {
      template: template?.id ?? null,
      ...Object.fromEntries(Object.entries(values).map(([key, value]) => [`value.${key}`, value])),
    }
  } catch {
    // An unknown product: the route answers 404, nothing changed
    return {}
  }
}

async function templateSnapshot(scope: Resolver, templateId: string): Promise<Snapshot> {
  const service = scope.resolve(PRODUCT_ATTRIBUTES_MODULE) as ProductAttributesModuleService
  const definitions = await service.listAttributeDefinitions(
    { template_id: templateId },
    { select: ["key", "label", "type", "unit", "options", "scope", "is_required"] }
  )
  return Object.fromEntries(
    definitions.map((definition) => [
      `definition.${definition.key}`,
      {
        label: definition.label,
        type: definition.type,
        unit: definition.unit,
        scope: definition.scope,
        required: definition.is_required,
        options: definition.options,
      },
    ])
  )
}

export const ATTRIBUTE_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/products/:id/attributes",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/attributes$`, "i"),
    resourceType: "product",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => productSnapshot(scope, params["id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/attribute-templates/:id",
    pattern: new RegExp(`^/admin/attribute-templates/(?<id>${ID})$`, "i"),
    resourceType: "attribute_template",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => templateSnapshot(scope, params["id"] ?? ""),
  },
]
