import { createFileRoute } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { SecurityPage } from "@/features/settings/pages/security-page"

export const Route = createFileRoute("/_auth/settings/security")({
  validateSearch: settingsTabSearch,
  component: SecurityPage,
})
