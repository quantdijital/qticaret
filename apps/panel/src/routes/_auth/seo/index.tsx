import { createFileRoute } from "@tanstack/react-router"
import { SeoOverviewPage } from "@/features/seo/pages/seo-page"

export const Route = createFileRoute("/_auth/seo/")({
  component: SeoOverviewPage,
})
