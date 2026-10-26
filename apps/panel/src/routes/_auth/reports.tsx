import { createFileRoute } from "@tanstack/react-router"
import { dashboardSearchSchema } from "@/features/dashboard/period"
import { ReportsLayout } from "@/features/reports/pages/reports-layout"

export const Route = createFileRoute("/_auth/reports")({
  validateSearch: dashboardSearchSchema,
  component: ReportsLayout,
})
