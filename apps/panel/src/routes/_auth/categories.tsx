import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { CategoriesPage } from "@/features/categories/pages/categories-page"

export const Route = createFileRoute("/_auth/categories")({
  validateSearch: z.object({ selected: z.string().max(64).optional().catch(undefined) }),
  component: CategoriesPage,
})
