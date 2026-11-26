import { createFileRoute, redirect } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { EinvoicePage } from "@/features/settings/pages/einvoice-page"

export const Route = createFileRoute("/_auth/settings/einvoice")({
  validateSearch: settingsTabSearch,
  // The carriers' invoice details live with the carriers now (the owner, 2026-11-26)
  beforeLoad: ({ search }) => {
    if (search.part === "carriers") {
      throw redirect({ to: "/settings/shipping", search: { part: "carriers" } })
    }
  },
  component: EinvoicePage,
})
