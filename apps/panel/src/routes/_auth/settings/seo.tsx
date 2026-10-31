import { createFileRoute } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { SeoPage } from "@/features/settings/pages/seo-page"

export const Route = createFileRoute("/_auth/settings/seo")({
  validateSearch: settingsTabSearch,
  component: SeoPage,
})
