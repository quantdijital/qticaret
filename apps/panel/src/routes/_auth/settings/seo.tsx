import { createFileRoute } from "@tanstack/react-router"
import { SeoPage } from "@/features/settings/pages/seo-page"

export const Route = createFileRoute("/_auth/settings/seo")({
  component: SeoPage,
})
