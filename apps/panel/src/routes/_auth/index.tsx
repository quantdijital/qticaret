import { createFileRoute } from "@tanstack/react-router"
import { DashboardRoute } from "@/features/dashboard/pages/dashboard-page"
import { dashboardSearchSchema } from "@/features/dashboard/period"

export const Route = createFileRoute("/_auth/")({
  validateSearch: dashboardSearchSchema,
  component: DashboardRoute,
})
