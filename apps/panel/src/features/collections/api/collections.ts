import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * Collections (Ürünler > Koleksiyonlar): the panel's list and page read
 * `/admin/collection-board`; title and handle, products and deletion are
 * Medusa's collection routes; the text, picture and visibility
 * `/admin/collections/:id/details`.
 */

export const COLLECTION_PAGE_SIZE = 25

export interface CollectionImage {
  url: string
  alt: string | null
}

export interface Collection {
  id: string
  title: string
  handle: string
  description: string | null
  is_active: boolean
  image: CollectionImage | null
  product_count: number
  created_at: string
  updated_at: string
}

export interface CollectionDetailsInput {
  description?: string | null
  is_active?: boolean
  image?: CollectionImage | null
}

const KEY = ["collections"] as const

export const collectionsQuery = ({ q, page }: { q: string; page: number }) =>
  queryOptions({
    queryKey: [...KEY, "list", { q, page }],
    queryFn: () =>
      sdk.client.fetch<{ collections: Collection[]; count: number }>("/admin/collection-board", {
        query: {
          offset: page * COLLECTION_PAGE_SIZE,
          limit: COLLECTION_PAGE_SIZE,
          ...(q ? { q } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  })

export const collectionQuery = (id: string) =>
  queryOptions({
    queryKey: [...KEY, "detail", id],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ collection: Collection }>(
          `/admin/collection-board/${encodeURIComponent(id)}`
        )
      ).collection,
  })

/** Collections whose title holds `q`, for a picker; a hidden one is marked. */
export const collectionOptions = async (q: string) =>
  (
    await sdk.client.fetch<{ collections: Collection[] }>("/admin/collection-board", {
      query: { limit: 20, ...(q ? { q } : {}) },
    })
  ).collections.map((collection) => ({
    id: collection.id,
    label: collection.title,
    inactive: !collection.is_active,
  }))

/** Every list that names collections: this screen's, the promotions' and menus' pickers, products. */
function useCollectionsChanged() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: KEY }),
      client.invalidateQueries({ queryKey: ["promotions", "collections"] }),
      client.invalidateQueries({ queryKey: ["storefront-menus", "options", "collection"] }),
      client.invalidateQueries({ queryKey: ["products"] }),
    ])
}

export function useCreateCollection() {
  const changed = useCollectionsChanged()
  return useMutation({
    mutationFn: async (title: string) =>
      (await sdk.admin.productCollection.create({ title })).collection,
    onSettled: changed,
  })
}

/** The title and handle: Medusa's fields; a new handle leaves the old path to redirect. */
export function useUpdateCollection(id: string) {
  const changed = useCollectionsChanged()
  return useMutation({
    mutationFn: (body: { title?: string; handle?: string }) =>
      sdk.admin.productCollection.update(id, body),
    onSettled: changed,
  })
}

/** The text, picture and visibility; a field left out keeps its value. */
export function useSetCollectionDetails(id: string) {
  const changed = useCollectionsChanged()
  return useMutation({
    mutationFn: (body: CollectionDetailsInput) =>
      sdk.client.fetch<{ collection: Collection }>(
        `/admin/collections/${encodeURIComponent(id)}/details`,
        { method: "POST", body }
      ),
    onSettled: changed,
  })
}

export function useDeleteCollection() {
  const changed = useCollectionsChanged()
  return useMutation({
    mutationFn: (id: string) => sdk.admin.productCollection.delete(id),
    onSettled: changed,
  })
}

/** Products into the collection (moved from another one) or out of it. */
export function useCollectionProducts(id: string) {
  const changed = useCollectionsChanged()
  return useMutation({
    mutationFn: (body: { add?: string[]; remove?: string[] }) =>
      sdk.admin.productCollection.updateProducts(id, body),
    onSettled: changed,
  })
}

export const COLLECTION_PRODUCTS_PAGE_SIZE = 20

export interface CollectionProduct {
  id: string
  title: string
  status: string
  thumbnail: string | null
}

/** The collection's products by title, a page at a time. */
export const collectionProductsQuery = (id: string, { q, page }: { q: string; page: number }) =>
  queryOptions({
    queryKey: [...KEY, "products", id, { q, page }],
    queryFn: async () => {
      const { products, count } = await sdk.admin.product.list({
        collection_id: [id],
        fields: "id,title,status,thumbnail",
        limit: COLLECTION_PRODUCTS_PAGE_SIZE,
        offset: page * COLLECTION_PRODUCTS_PAGE_SIZE,
        order: "title",
        ...(q ? { q } : {}),
      })
      return { products: products, count }
    },
    placeholderData: keepPreviousData,
  })
