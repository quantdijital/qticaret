import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

// A photo's fields only, as the storefront asks for them
const PHOTO_FIELDS = "id,title,thumbnail,images.url,images.rank"

interface Photographed {
  id: string
  thumbnail?: string | null
  images?: { url: string; rank: number }[] | null
}

/** A product's photo as the storefront picks it (`productImages`): its first by rank, else its thumbnail. */
export const photoOf = (product: Photographed): string | null => {
  const [first] = [...(product.images ?? [])].sort((a, b) => a.rank - b.rank)
  return first?.url ?? product.thumbnail ?? null
}

const KEY = ["storefront", "strip-photos"] as const

/** The strips' products' photos, by id. */
export const productPhotosQuery = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...KEY, "products", [...ids].sort()],
    queryFn: async () =>
      new Map(
        (
          await sdk.admin.product.list({ id: [...ids], fields: PHOTO_FIELDS, limit: ids.length })
        ).products.map((product) => [product.id, photoOf(product)])
      ),
    enabled: ids.length > 0,
  })

/**
 * A collection without a picture of its own, as the storefront draws its
 * strip (`stripSources` in apps/storefront): the photo of its newest
 * published product; null when it has none.
 */
export const collectionPhotoQuery = (id: string) =>
  queryOptions({
    queryKey: [...KEY, "collection", id],
    queryFn: async () => {
      const { products } = await sdk.admin.product.list({
        collection_id: [id],
        status: ["published"],
        limit: 1,
        order: "-created_at",
        fields: PHOTO_FIELDS,
      })
      const [product] = products
      return product ? photoOf(product) : null
    },
  })

/**
 * A brand as the storefront draws its strip: not its logo (a mark, not a
 * photograph) but the photo of its newest published product, read through
 * the product board (Medusa's own list cannot filter by brand); null when
 * it has none.
 */
export const brandPhotoQuery = (id: string) =>
  queryOptions({
    queryKey: [...KEY, "brand", id],
    queryFn: async () => {
      const { ids } = await sdk.client.fetch<{ ids: string[] }>("/admin/product-board", {
        query: { brand_id: id, status: "published", order: "-created_at", offset: 0, limit: 1 },
      })
      if (ids.length === 0) {
        return null
      }
      const { products } = await sdk.admin.product.list({
        id: ids,
        fields: PHOTO_FIELDS,
        limit: ids.length,
      })
      const [product] = products
      return product ? photoOf(product) : null
    },
  })
