import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { CategoriesPage } from "@/features/categories/pages/categories-page"

/**
 * `/categories?q=bicak`. `selected` is the old split view's choice: a
 * category's id goes to its own page, so links made before it still
 * open it; `new` opens the new category's dialog.
 */
const categoriesSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  selected: z.string().max(64).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/categories/")({
  validateSearch: categoriesSearchSchema,
  beforeLoad: ({ search }) => {
    if (search.selected && search.selected !== "new") {
      throw redirect({
        to: "/categories/$id",
        params: { id: search.selected },
        replace: true,
      })
    }
  },
  component: CategoriesPage,
})
