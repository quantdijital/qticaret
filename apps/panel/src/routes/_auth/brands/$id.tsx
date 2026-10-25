import { createFileRoute } from "@tanstack/react-router"
import { BrandPage } from "@/features/brands/pages/brand-page"

export const Route = createFileRoute("/_auth/brands/$id")({
  component: BrandPage,
})
