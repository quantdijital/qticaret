import { useQueries, useQuery } from "@tanstack/react-query"
import type { StripRecordKind } from "@qticaret/types"
import { brandQuery } from "@/features/brands/api/brands"
import { categoryImagesQuery } from "@/features/categories/api/images"
import { collectionQuery } from "@/features/collections/api/collections"
import { productNamesQuery } from "@/features/promotions/api/scope-options"
import type { StripItem } from "@/features/storefront/api/layout"
import { targetOf } from "./strip-items"

const KEEP_MS = 60_000

/** A strip row's small picture: a photo fills its box, a brand's logo sits whole in it. */
export interface StripPicture {
  url: string
  fit: "cover" | "contain"
}

const only = (url: string | null | undefined, fit: StripPicture["fit"]): StripPicture | null =>
  url ? { url, fit } : null

/**
 * The picture a strip's row shows (adr/0049 Ek 2026-11-16): the shop's own
 * when it gave one, else its record's (a product's small picture, a
 * category's or a collection's picture, a brand's logo), read through the
 * lists the editor already reads; null when neither has one, and the row
 * keeps its placeholder.
 */
export function useStripPictures(
  items: readonly StripItem[]
): (item: StripItem) => StripPicture | null {
  const ids = (kind: StripRecordKind) => [
    ...new Set(
      items.flatMap((item) => {
        const target = targetOf(item)
        return item.source.kind === kind && target ? [target] : []
      })
    ),
  ]
  const products = useQuery({ ...productNamesQuery(ids("product")), staleTime: KEEP_MS })
  const categories = useQuery({
    ...categoryImagesQuery(),
    enabled: ids("category").length > 0,
    staleTime: KEEP_MS,
  })
  const collections = useQueries({
    queries: ids("collection").map((id) => ({ ...collectionQuery(id), staleTime: KEEP_MS })),
  })
  const brands = useQueries({
    queries: ids("brand").map((id) => ({ ...brandQuery(id), staleTime: KEEP_MS })),
  })
  const sourceOf = (item: StripItem): StripPicture | null => {
    const target = targetOf(item)
    if (item.source.kind === "custom" || !target) {
      return null
    }
    switch (item.source.kind) {
      case "product":
        return only(products.data?.find((each) => each.id === target)?.thumbnail, "cover")
      case "category":
        return only(categories.data?.get(target)?.url, "cover")
      case "collection":
        return only(collections.find((each) => each.data?.id === target)?.data?.image?.url, "cover")
      case "brand":
        return only(brands.find((each) => each.data?.id === target)?.data?.logo_url, "contain")
    }
  }
  return (item) => only(item.image?.url, "cover") ?? sourceOf(item)
}
