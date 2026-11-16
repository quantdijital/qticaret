import { useQueries, useQuery } from "@tanstack/react-query"
import type { StripRecordKind } from "@qticaret/types"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { categoryFallbackQuery, categoryImagesQuery } from "@/features/categories/api/images"
import { descendantsOf } from "@/features/categories/tree"
import { collectionQuery } from "@/features/collections/api/collections"
import type { StripItem } from "@/features/storefront/api/layout"
import { brandPhotoQuery, collectionPhotoQuery, productPhotosQuery } from "./strip-photos"
import { targetOf } from "./strip-items"

const KEEP_MS = 60_000

/**
 * The picture a strip's row shows: the one the storefront draws for it
 * (`stripItemView` in apps/storefront, adr/0049 Ek 2026-11-16). The
 * shop's own when it gave one; else its record's: a product's photo; a
 * category's or a collection's picture, else the photo of its newest
 * published product (a category's from it or one under it); a brand's
 * newest product's photo, never its logo. Read through the lists the
 * editor already reads; null when there is none, and the row keeps its
 * placeholder (the storefront leaves such a strip out).
 */
export function useStripPictures(items: readonly StripItem[]): (item: StripItem) => string | null {
  const ids = (kind: StripRecordKind) => [
    ...new Set(
      items.flatMap((item) => {
        const target = targetOf(item)
        // The shop's own picture wins: its record's is not asked for
        return item.source.kind === kind && target && !item.image ? [target] : []
      })
    ),
  ]
  const products = useQuery({ ...productPhotosQuery(ids("product")), staleTime: KEEP_MS })

  const categoryIds = ids("category")
  const categories = useQuery({
    ...categoryImagesQuery(),
    enabled: categoryIds.length > 0,
    staleTime: KEEP_MS,
  })
  const bare = categories.data ? categoryIds.filter((id) => !categories.data.has(id)) : []
  const tree = useQuery({ ...categoryTreeQuery(), enabled: bare.length > 0, staleTime: KEEP_MS })
  const categoryPhotos = useQueries({
    queries: tree.data
      ? bare.map((id) => ({
          ...categoryFallbackQuery([id, ...descendantsOf(tree.data, id)]),
          staleTime: KEEP_MS,
        }))
      : [],
  })

  const collectionIds = ids("collection")
  const collections = useQueries({
    queries: collectionIds.map((id) => ({ ...collectionQuery(id), staleTime: KEEP_MS })),
  })
  const plain = collectionIds.filter((id, at) => {
    const collection = collections[at]?.data
    return collection !== undefined && !collection.image?.url
  })
  const collectionPhotos = useQueries({
    queries: plain.map((id) => ({ ...collectionPhotoQuery(id), staleTime: KEEP_MS })),
  })

  const brandIds = ids("brand")
  const brands = useQueries({
    queries: brandIds.map((id) => ({ ...brandPhotoQuery(id), staleTime: KEEP_MS })),
  })

  const sourceOf = (item: StripItem): string | null => {
    const target = targetOf(item)
    if (item.source.kind === "custom" || !target) {
      return null
    }
    switch (item.source.kind) {
      case "product":
        return products.data?.get(target) ?? null
      case "category": {
        const own = categories.data?.get(target)?.url
        return own ?? categoryPhotos[bare.indexOf(target)]?.data?.url ?? null
      }
      case "collection": {
        const own = collections[collectionIds.indexOf(target)]?.data?.image?.url
        return own ?? collectionPhotos[plain.indexOf(target)]?.data ?? null
      }
      case "brand":
        return brands[brandIds.indexOf(target)]?.data ?? null
    }
  }
  return (item) => item.image?.url ?? sourceOf(item)
}
