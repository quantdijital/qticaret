import { createFileRoute } from "@tanstack/react-router"
import { ApiAccessPage } from "@/features/settings/pages/api-access-page"

export const Route = createFileRoute("/_auth/settings/api")({
  component: ApiAccessPage,
})
