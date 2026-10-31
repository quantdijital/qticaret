import { createFileRoute } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { EinvoicePage } from "@/features/settings/pages/einvoice-page"

export const Route = createFileRoute("/_auth/settings/einvoice")({
  validateSearch: settingsTabSearch,
  component: EinvoicePage,
})
