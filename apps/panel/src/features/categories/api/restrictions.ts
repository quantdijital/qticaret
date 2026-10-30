import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Why a product is sold to adults only (F13.4); a category's mark reaches its children. */
export const RESTRICTIONS = ["weapon", "alcohol", "tobacco", "adult_content", "other"] as const
export type Restriction = (typeof RESTRICTIONS)[number]

const KEY = ["categories", "restrictions"] as const

/** `GET /admin/category-restrictions`: every marked category, by id. */
export const categoryRestrictionsQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: async () =>
      new Map(
        (
          await sdk.client.fetch<{
            restrictions: { category_id: string; restriction: Restriction }[]
          }>("/admin/category-restrictions")
        ).restrictions.map((row) => [row.category_id, row.restriction])
      ),
  })

export function useSetCategoryRestriction(categoryId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (restriction: Restriction | null) =>
      sdk.client.fetch(`/admin/category-restrictions/${encodeURIComponent(categoryId)}`, {
        method: "POST",
        body: { restriction },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: KEY })
    },
  })
}
