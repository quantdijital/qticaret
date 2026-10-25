import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { containsPattern } from "../../../../lib/security"
import { URL_REGISTRY_MODULE } from "../../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../../modules/url-registry/service"
import type { UrlOwner } from "../../../../modules/url-registry/validation"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../../../workflows/catalog/entity-paths"
import { followPath } from "../../../../workflows/seo/redirects/resolve"
import type { AdminGetOldPathsType } from "../redirects/validators"

const NAMES: Readonly<Record<string, { entity: string; field: string }>> = {
  [CATALOG_ENTITY_TYPES.product]: { entity: "product", field: "title" },
  [CATALOG_ENTITY_TYPES.category]: { entity: "product_category", field: "name" },
  [CATALOG_ENTITY_TYPES.collection]: { entity: "product_collection", field: "title" },
}

interface Owner {
  name: string | null
  deleted: boolean
}

/** The records' names, deleted ones too; one query per kind of record. */
async function owners(container: MedusaContainer, list: UrlOwner[]): Promise<Map<string, Owner>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const found = new Map<string, Owner>()
  for (const [type, spec] of Object.entries(NAMES)) {
    const ids = [
      ...new Set(list.filter((each) => each.entity_type === type).map((each) => each.entity_id)),
    ]
    if (ids.length === 0) {
      continue
    }
    const { data } = await query.graph({
      entity: spec.entity,
      fields: ["id", spec.field, "deleted_at"],
      filters: { id: ids },
      withDeleted: true,
    })
    for (const row of data as Record<string, unknown>[]) {
      const name = row[spec.field]
      found.set(`${type}:${String(row["id"])}`, {
        name: typeof name === "string" ? name : null,
        deleted: Boolean(row["deleted_at"]),
      })
    }
  }
  return found
}

/**
 * Paths records gave up (a slug change, a move, a deletion), kept so their
 * visitors still arrive (docs/13 §2.1): whose they were and what they
 * answer now. Releasing one makes it free for another record.
 */
export async function readOldPaths(container: MedusaContainer, query: AdminGetOldPathsType) {
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const search = query.q?.toLowerCase()
  const [entries, count] = await registry.listAndCountUrlEntries(
    {
      locale: CATALOG_LOCALE,
      status: "reserved",
      ...(search ? { path: { $ilike: containsPattern(search) } } : {}),
    },
    { skip: query.offset, take: query.limit, order: { updated_at: "DESC" } }
  )
  const names = await owners(container, entries)
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const { resolution } = await followPath(
        container,
        { path: entry.path, query: new URLSearchParams() },
        { countHits: false }
      )
      const owner = names.get(`${entry.entity_type}:${entry.entity_id}`)
      return {
        path: entry.path,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        name: owner?.name ?? null,
        deleted: owner?.deleted ?? true,
        answer: resolution.type,
        location: resolution.type === "redirect" ? resolution.location : null,
        since: entry.updated_at,
      }
    })
  )
  return { paths, count, offset: query.offset, limit: query.limit }
}
