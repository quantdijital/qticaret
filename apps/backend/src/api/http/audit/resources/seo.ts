import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SEO_ENTITIES, SEO_FIELDS, isSeoEntityType } from "../../../../workflows/seo/entities"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * A page's own SEO fields (adr/0015, adr/0011): title, description, focus
 * keyword, canonical and robots overrides, OG image and its alt text,
 * before and after. Hashes are derived and left out.
 */
async function seoSnapshot(scope: Resolver, type: string, id: string): Promise<Snapshot> {
  if (!isSeoEntityType(type)) {
    return {}
  }
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: SEO_ENTITIES[type].entity,
    fields: SEO_FIELDS.map((field) => `seo_meta.${field}`),
    filters: { id },
  })
  const row = data[0] as { seo_meta?: Record<string, unknown> | null } | undefined
  return row
    ? Object.fromEntries(SEO_FIELDS.map((field) => [field, row.seo_meta?.[field] ?? null]))
    : {}
}

export const SEO_RESOURCES: readonly AuditedResource[] = [
  {
    method: "PUT",
    route: "PUT /admin/seo/:entity_type/:entity_id",
    pattern: new RegExp(`^/admin/seo/(?<type>[a-z]+)/(?<id>${ID})$`, "i"),
    resourceType: "seo_meta",
    resourceId: (params) =>
      params["type"] && params["id"] ? `${params["type"]}:${params["id"]}` : null,
    snapshot: ({ scope, params }) => seoSnapshot(scope, params["type"] ?? "", params["id"] ?? ""),
  },
]
