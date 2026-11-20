import { createFileRoute } from "@tanstack/react-router"
import { CategoryPage } from "@/features/categories/pages/category-page"

export const Route = createFileRoute("/_auth/categories/$id")({
  component: CategoryPage,
})
