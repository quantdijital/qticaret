import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Add-on templates (adr/0011, adr/0052 Ek 2026-11-23), read from the
 * database: a template's name and add-ons (one value, so a change shows
 * as before and after); a product's linked templates; an attribute
 * template's carried ones. A removed template reads as empty.
 */

const query = (scope: Resolver) =>
  (scope as unknown as MedusaContainer).resolve(ContainerRegistrationKeys.QUERY)

async function templateSnapshot(scope: Resolver, id: string): Promise<Snapshot> {
  const { data } = await query(scope).graph({
    entity: "addon_template",
    fields: ["id", "name", "addons"],
    filters: { id },
  })
  const row = data[0] as { name: string; addons?: unknown } | undefined
  return row ? { name: row.name, addons: JSON.stringify(row.addons ?? null) } : {}
}

async function productLinksSnapshot(scope: Resolver, productId: string): Promise<Snapshot> {
  const { data } = await query(scope).graph({
    entity: "product",
    fields: ["id", "addon_templates.id"],
    filters: { id: productId },
  })
  const row = data[0] as { addon_templates?: ({ id: string } | null)[] | null } | undefined
  if (!row) {
    return {}
  }
  const ids = (row.addon_templates ?? []).flatMap((each) => (each ? [each.id] : [])).sort()
  return { addon_templates: ids.join(",") }
}

async function carriedSnapshot(scope: Resolver, id: string): Promise<Snapshot> {
  const { data } = await query(scope).graph({
    entity: "attribute_template",
    fields: ["id", "addon_template_ids"],
    filters: { id },
  })
  const row = data[0] as { addon_template_ids?: unknown } | undefined
  return row ? { addon_templates: JSON.stringify(row.addon_template_ids ?? null) } : {}
}

export const ADDON_TEMPLATE_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/addon-templates/:id",
    pattern: new RegExp(`^/admin/addon-templates/(?<id>${ID})$`, "i"),
    resourceType: "addon_template",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => templateSnapshot(scope, params["id"] ?? ""),
  },
  {
    method: "DELETE",
    route: "DELETE /admin/addon-templates/:id",
    pattern: new RegExp(`^/admin/addon-templates/(?<id>${ID})$`, "i"),
    resourceType: "addon_template",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => templateSnapshot(scope, params["id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/products/:id/addon-templates",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/addon-templates$`, "i"),
    resourceType: "product",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => productLinksSnapshot(scope, params["id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/attribute-templates/:id/addon-templates",
    pattern: new RegExp(`^/admin/attribute-templates/(?<id>${ID})/addon-templates$`, "i"),
    resourceType: "attribute_template",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => carriedSnapshot(scope, params["id"] ?? ""),
  },
]
