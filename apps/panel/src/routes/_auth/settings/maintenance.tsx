import { createFileRoute } from "@tanstack/react-router"
import { MaintenancePage } from "@/features/settings/pages/maintenance-page"

/** `/settings/maintenance`: maintenance or "coming soon" (adr/0053). */
export const Route = createFileRoute("/_auth/settings/maintenance")({
  component: MaintenancePage,
})
