import { createFileRoute } from "@tanstack/react-router"
import { seoSearchSchema } from "@/features/seo/search"
import { SeoPage } from "@/features/settings/pages/seo-page"

export const Route = createFileRoute("/_auth/settings/seo")({
  validateSearch: seoSearchSchema,
  component: SeoPage,
})
