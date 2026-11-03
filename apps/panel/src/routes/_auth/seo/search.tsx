import { createFileRoute } from "@tanstack/react-router"
import { SiteSearchPage } from "@/features/seo/pages/site-search-page"
import { siteSearchSearchSchema } from "@/features/seo/search"

export const Route = createFileRoute("/_auth/seo/search")({
  validateSearch: siteSearchSearchSchema,
  component: SiteSearchPage,
})
