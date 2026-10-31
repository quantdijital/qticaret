import { createFileRoute } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { MarketingPage } from "@/features/settings/pages/marketing-page"

export const Route = createFileRoute("/_auth/settings/marketing/")({
  validateSearch: settingsTabSearch,
  component: MarketingPage,
})
