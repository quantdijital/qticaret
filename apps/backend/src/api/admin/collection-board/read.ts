import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { containsPattern } from "../../../lib/security"
import { COLLECTION_EXTENSION_FIELDS } from "../../../workflows/catalog/collection-fields"
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

/** A page of collections by title, with their product counts, pictures and visibility. */
export async function readCollections(
  container: MedusaContainer,
  query: AdminGetCollectionBoardType
) {
  const { data, metadata } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_collection",
    fields: FIELDS,
    filters: query.q ? { title: { $ilike: containsPattern(query.q) } } : {},
    pagination: { skip: query.offset, take: query.limit, order: { title: "ASC" } },
  })
  const rows = data as CollectionRow[]
  const counts = await productCounts(
    container,
    rows.map((row) => row.id)
  )
  return {
    collections: rows.map((row) => presentCollection(row, counts.get(row.id) ?? 0)),
    count: metadata?.count ?? rows.length,
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
