import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { UrlOwner } from "../../modules/url-registry/validation"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { liveLandingFilters } from "../content/landing-facet"

/** The records a path can belong to, and what makes one live (on the shop, its page answering). */
export interface LiveSpec {
  entity: string
  type: string
  /** Read when asked: a landing page shows while its category does (F3.16). */
  filters: (container: MedusaContainer) => Promise<Record<string, unknown>>
}

const fixed = (filters: Record<string, unknown>) => (): Promise<Record<string, unknown>> =>
  Promise.resolve(filters)

export const LIVE_RECORDS: readonly LiveSpec[] = [
  {
    entity: "product",
    type: CATALOG_ENTITY_TYPES.product,
    filters: fixed({ status: "published" }),
  },
  {
    entity: "product_category",
    type: CATALOG_ENTITY_TYPES.category,
    filters: fixed({ is_active: true, is_internal: false }),
  },
  { entity: "brand", type: CATALOG_ENTITY_TYPES.brand, filters: fixed({ is_active: true }) },
  { entity: "product_collection", type: CATALOG_ENTITY_TYPES.collection, filters: fixed({}) },
  {
    entity: "content_entry",
    type: CATALOG_ENTITY_TYPES.page,
    filters: fixed({ kind: "page", status: "published" }),
  },
  {
    entity: "content_entry",
    type: CATALOG_ENTITY_TYPES.post,
    filters: fixed({ kind: "post", status: "published" }),
  },
  { entity: "landing_page", type: CATALOG_ENTITY_TYPES.landing, filters: liveLandingFilters },
]

// Ids per query: an IN list well below Postgres' bind limit
const ID_CHUNK = 5000

/** Which of the owners are live, as `type:id`; one query per kind of record. */
export async function liveOwnerKeys(
  container: MedusaContainer,
  owners: readonly UrlOwner[]
): Promise<Set<string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const live = new Set<string>()
  for (const spec of LIVE_RECORDS) {
    const ids = owners
      .filter((owner) => owner.entity_type === spec.type)
      .map((owner) => owner.entity_id)
    const filters = ids.length > 0 ? await spec.filters(container) : {}
    for (let start = 0; start < ids.length; start += ID_CHUNK) {
      const { data } = await query.graph({
        entity: spec.entity,
        fields: ["id"],
        filters: { ...filters, id: ids.slice(start, start + ID_CHUNK) },
      })
      for (const row of data as { id: string }[]) {
        live.add(`${spec.type}:${row.id}`)
      }
    }
  }
  return live
}
