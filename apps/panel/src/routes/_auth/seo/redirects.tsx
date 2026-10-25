import { createFileRoute } from "@tanstack/react-router"
import { RedirectsPage } from "@/features/seo/pages/redirects-page"
import { redirectsSearchSchema } from "@/features/seo/search"

export const Route = createFileRoute("/_auth/seo/redirects")({
  validateSearch: redirectsSearchSchema,
  component: RedirectsPage,
})
