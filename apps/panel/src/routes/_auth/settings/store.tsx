import { createFileRoute } from "@tanstack/react-router"
import { StorePage } from "@/features/settings/pages/store-page"

export const Route = createFileRoute("/_auth/settings/store")({
  component: StorePage,
})
