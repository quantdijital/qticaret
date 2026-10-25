import { createFileRoute } from "@tanstack/react-router"
import { AppearancePage } from "@/features/settings/pages/appearance-page"

export const Route = createFileRoute("/_auth/settings/appearance")({
  component: AppearancePage,
})
