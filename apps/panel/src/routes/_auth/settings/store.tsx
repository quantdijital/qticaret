import { createFileRoute } from "@tanstack/react-router"
import { StorePage } from "@/features/settings/pages/store-page"
import { storeTabSearch } from "@/features/settings/store-tabs"

export const Route = createFileRoute("/_auth/settings/store")({
  validateSearch: storeTabSearch,
  component: StorePage,
})
