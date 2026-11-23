import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { storedListingDoc } from "../../../lib/catalog/listing-description"
import { containsPattern } from "../../../lib/security"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import {
  COLLECTION_EXTENSION_FIELDS,
  COLLECTION_LIVE_FIELDS,
  isCollectionShown,
} from "../../../workflows/catalog/collection-fields"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../../workflows/catalog/entity-paths"
import type { CollectionExtensionRow } from "../../../workflows/catalog/collection-fields"
import type { AdminGetCollectionBoardType } from "./validators"

interface CollectionRow {
  id: string
  title: string
  handle: string
  created_at: string | Date
  updated_at: string | Date
  collection_extension?: (CollectionExtensionRow & { updated_at?: string | Date }) | null
}

const FIELDS = [
  "id",
  "title",
  "handle",
  "created_at",
  "updated_at",
  ...COLLECTION_EXTENSION_FIELDS,
  "collection_extension.updated_at",
]

const later = (a: string | Date, b: string | Date | undefined): string | Date =>
  b !== undefined && new Date(b).getTime() > new Date(a).getTime() ? b : a

/**
 * A collection as the panel shows it: Medusa's fields, ours, and how many
 * products it holds. Its last change is either record's, so a save of its
 * text asks the advisor again.
 */
export const presentCollection = (row: CollectionRow, products: number) => {
  const own = row.collection_extension ?? null
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    description: own?.description ?? null,
    // adr/0075: the panel's editor opens it; null: plain text only (the editor opens its paragraphs)
    description_doc: storedListingDoc(own?.description_doc),
    is_active: own?.is_active !== false,
    image: own?.image_url ? { url: own.image_url, alt: own.image_alt ?? null } : null,
    product_count: products,
    created_at: row.created_at,
    updated_at: later(row.updated_at, own?.updated_at),
  }
}

/** How many products each collection holds, drafts included: one count each. */
async function productCounts(
  container: MedusaContainer,
  ids: string[]
): Promise<Map<string, number>> {
  const products = container.resolve(Modules.PRODUCT)
  const counts = await Promise.all(
    ids.map(
      async (id) =>
        [
          id,
          (
            await products.listAndCountProducts({ collection_id: id }, { select: ["id"], take: 1 })
          )[1],
        ] as const
    )
  )
  return new Map(counts)
}

/**
 * How many collections have a page on the storefront by their own state:
 * shown and holding an active path. What turning `catalog.collections` off
 * would take offline (the panel's warning says the count); the flag itself
 * is not read, so the number stays the same either way.
 */
async function liveCount(container: MedusaContainer): Promise<number> {
  const entries = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      { locale: CATALOG_LOCALE, entity_type: CATALOG_ENTITY_TYPES.collection, status: "active" },
      { select: ["entity_id"] }
    )
  if (entries.length === 0) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_collection",
    fields: ["id", ...COLLECTION_LIVE_FIELDS],
    filters: { id: [...new Set(entries.map((entry) => entry.entity_id))] },
  })
  return (data as CollectionRow[]).filter(isCollectionShown).length
}

/** A page of collections by title, with their product counts, pictures and visibility. */
export async function readCollections(
  container: MedusaContainer,
  query: AdminGetCollectionBoardType
) {
  const [{ data, metadata }, live] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product_collection",
      fields: FIELDS,
      filters: query.q ? { title: { $ilike: containsPattern(query.q) } } : {},
      pagination: { skip: query.offset, take: query.limit, order: { title: "ASC" } },
    }),
    liveCount(container),
  ])
  const rows = data as CollectionRow[]
  const counts = await productCounts(
    container,
    rows.map((row) => row.id)
  )
  return {
    collections: rows.map((row) => presentCollection(row, counts.get(row.id) ?? 0)),
    count: metadata?.count ?? rows.length,
    live_count: live,
    offset: query.offset,
    limit: query.limit,
  }
}

export async function readCollection(container: MedusaContainer, id: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_collection",
    fields: FIELDS,
    filters: { id },
  })
  const row = data[0] as CollectionRow | undefined
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.collection_unknown")
  }
  const counts = await productCounts(container, [id])
  return presentCollection(row, counts.get(id) ?? 0)
}
