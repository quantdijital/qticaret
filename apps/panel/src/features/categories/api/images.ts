import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A category's picture: the storefront's category cards and menu show it (adr/0046 Ek 2026-11-04). */
export interface CategoryImage {
  url: string
  alt: string | null
}

const KEY = ["categories", "images"] as const

/** `GET /admin/category-images`: every category that has a picture, by id. */
export const categoryImagesQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: async () =>
      new Map(
        (
          await sdk.client.fetch<{
            images: ({ category_id: string } & CategoryImage)[]
          }>("/admin/category-images")
        ).images.map(({ category_id, url, alt }) => [category_id, { url, alt }])
      ),
  })

/** Sets a category's picture from the media library, or takes it off with null. */
export function useSetCategoryImage(categoryId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (image: CategoryImage | null) =>
      sdk.client.fetch<{ image: ({ category_id: string } & CategoryImage) | null }>(
        `/admin/category-images/${encodeURIComponent(categoryId)}`,
        { method: "POST", body: { image } }
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: KEY })
    },
  })
}

/** What the storefront shows for a category without a picture of its own. */
export interface CategoryFallback {
  /** The newest product's title. */
  title: string
  /** Its first photo; null when that product has none. */
  url: string | null
}

// A photo's fields only, as the storefront asks for them
const FALLBACK_FIELDS = "id,title,thumbnail,images.url,images.rank"

/**
 * The storefront's fallback for a category without a picture (`newestPhoto`
 * in apps/storefront, docs/tema/yon-2026-11-05.md § Reyon kartı): the
 * first photo of the newest published product in it or a category under
 * it. Null when it has no published product.
 */
export const categoryFallbackQuery = (categoryIds: readonly string[]) =>
  queryOptions({
    queryKey: [...KEY, "fallback", [...categoryIds].sort()],
    queryFn: async (): Promise<CategoryFallback | null> => {
      const { products } = await sdk.admin.product.list({
        category_id: [...categoryIds],
        status: ["published"],
        limit: 1,
        order: "-created_at",
        fields: FALLBACK_FIELDS,
      })
      const [product] = products
      if (!product) {
        return null
      }
      const [first] = [...(product.images ?? [])].sort((a, b) => a.rank - b.rank)
      return { title: product.title, url: first?.url ?? product.thumbnail ?? null }
    },
  })
