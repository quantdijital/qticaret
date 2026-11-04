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
