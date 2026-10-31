import { createFileRoute } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { PaymentsPage } from "@/features/settings/pages/payments-page"

export const Route = createFileRoute("/_auth/settings/payments/")({
  validateSearch: settingsTabSearch,
  component: PaymentsPage,
})
