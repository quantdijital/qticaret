import { createFileRoute } from "@tanstack/react-router"
import { settingsTabSearch } from "@/features/settings/tab-search"
import { ShippingPage } from "@/features/settings/pages/shipping-page"

export const Route = createFileRoute("/_auth/settings/shipping/")({
  validateSearch: settingsTabSearch,
  component: ShippingPage,
})
