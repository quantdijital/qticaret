import { createFileRoute } from "@tanstack/react-router"
import { dashboardSearchSchema } from "@/features/dashboard/period"
import { ReportsPage } from "@/features/reports/pages/reports-page"

export const Route = createFileRoute("/_auth/reports")({
  validateSearch: dashboardSearchSchema,
  component: ReportsPage,
})
