import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

const FIELDS = "id,name,handle,description,parent_category_id,rank,is_active,is_internal,updated_at"

/** Every category, for the tree; a shop has hundreds at most. */
export const categoryTreeQuery = () =>
  queryOptions({
    queryKey: ["categories", "tree"],
    queryFn: async () =>
      (await sdk.admin.productCategory.list({ fields: FIELDS, limit: 1000 })).product_categories,
  })

export type Category = Awaited<
  ReturnType<typeof sdk.admin.productCategory.list>
>["product_categories"][number]

export interface CategoryInput {
  name: string
  handle?: string
  description: string
  parent_category_id: string | null
  is_active: boolean
  is_internal: boolean
}

function useCategoryMutation<T, R>(run: (input: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["categories"] })
      // The product forms' pickers read the same tree
      await client.invalidateQueries({ queryKey: ["lookups", "categories"] })
    },
  })
}

export const useCreateCategory = () =>
  useCategoryMutation(
    async (input: CategoryInput) => (await sdk.admin.productCategory.create(input)).product_category
  )

export const useUpdateCategory = () =>
  useCategoryMutation(({ id, ...input }: Partial<CategoryInput> & { id: string; rank?: number }) =>
    sdk.admin.productCategory.update(id, input)
  )

export const useDeleteCategory = () =>
  useCategoryMutation((id: string) => sdk.admin.productCategory.delete(id))
