import { createFileRoute } from "@tanstack/react-router"
import { reportSearchSchema } from "@/features/reports/range"
import { ReportsLayout } from "@/features/reports/pages/reports-layout"

export const Route = createFileRoute("/_auth/reports")({
  validateSearch: reportSearchSchema,
  component: ReportsLayout,
})
