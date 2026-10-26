import { createFileRoute } from "@tanstack/react-router"
import { CategoryReportPage } from "@/features/reports/pages/category-report-page"

export const Route = createFileRoute("/_auth/reports/categories")({
  component: CategoryReportPage,
})
