import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuditEntityKind } from "../../../lib/seo/audit"
import { CATALOG_ENTITY_TYPES } from "../../catalog/entity-paths"

// Each finding keeps this many items for its report; `count` says how many there are
export const MAX_LISTED = 200

const ENTITIES: Record<AuditEntityKind, { entity: string; name: string; type: string }> = {
  product: { entity: "product", name: "title", type: CATALOG_ENTITY_TYPES.product },
  category: { entity: "product_category", name: "name", type: CATALOG_ENTITY_TYPES.category },
  brand: { entity: "brand", name: "name", type: CATALOG_ENTITY_TYPES.brand },
  collection: {
    entity: "product_collection",
    name: "title",
    type: CATALOG_ENTITY_TYPES.collection,
  },
  page: { entity: "content_entry", name: "title", type: CATALOG_ENTITY_TYPES.page },
  post: { entity: "content_entry", name: "title", type: CATALOG_ENTITY_TYPES.post },
}

export const AUDIT_KINDS = Object.keys(ENTITIES) as AuditEntityKind[]

/** The audit's kind of a URL registry owner type; undefined for others. */
export const kindOfType = (type: string): AuditEntityKind | undefined =>
  AUDIT_KINDS.find((kind) => ENTITIES[kind].type === type)

export interface Named {
  name: string
  handle: string
}

/** Names and handles of records that still exist (deleted ones are left out). */
export async function namesOf(
  container: MedusaContainer,
  kind: AuditEntityKind,
  ids: readonly string[]
): Promise<Map<string, Named>> {
  if (ids.length === 0) {
    return new Map()
  }
  const { entity, name } = ENTITIES[kind]
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity,
    fields: ["id", "handle", name],
    filters: { id: [...ids] },
  })
  return new Map(
    (data as Record<string, unknown>[]).map((row) => {
      const value = row[name]
      const handle = row["handle"]
      return [
        String(row["id"]),
        {
          name: typeof value === "string" ? value : "",
          handle: typeof handle === "string" ? handle : "",
        },
      ]
    })
  )
}

/** Labels that tell the pages apart: a name another page shares gets its handle beside it. */
export function labelsOf(pages: readonly Named[]): string[] {
  const seen = new Map<string, number>()
  for (const page of pages) {
    seen.set(page.name, (seen.get(page.name) ?? 0) + 1)
  }
  return pages.map((page) =>
    (seen.get(page.name) ?? 0) > 1 && page.handle ? `${page.name} (${page.handle})` : page.name
  )
}
