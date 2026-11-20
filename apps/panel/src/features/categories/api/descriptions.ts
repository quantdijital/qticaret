import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { sdk } from "@/lib/sdk"

/**
 * A category's own text (adr/0075): the document in our extension row,
 * its plain text Medusa's `description`, which the server writes from it.
 */
export interface CategoryDescription {
  category_id: string
  description: string
  description_doc: JSONContent | null
}

const keyOf = (categoryId: string) => ["categories", "descriptions", categoryId] as const

const pathOf = (categoryId: string) =>
  `/admin/category-descriptions/${encodeURIComponent(categoryId)}`

/** `GET /admin/category-descriptions/:category_id`. */
export const categoryDescriptionQuery = (categoryId: string) =>
  queryOptions({
    queryKey: keyOf(categoryId),
    queryFn: async () =>
      (await sdk.client.fetch<{ description: CategoryDescription }>(pathOf(categoryId)))
        .description,
  })

/**
 * Writes the document (the only field the route takes); the saved record
 * goes in the cache before the call resolves, and the tree, which carries
 * the plain text (the search preview's fallback), is read again.
 */
export function useSetCategoryDescription(categoryId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (description_doc: JSONContent | null) =>
      (
        await sdk.client.fetch<{ description: CategoryDescription }>(pathOf(categoryId), {
          method: "POST",
          body: { description_doc },
        })
      ).description,
    onSuccess: async (saved) => {
      client.setQueryData(keyOf(categoryId), saved)
      await client.invalidateQueries({ queryKey: ["categories", "tree"] })
    },
  })
}
