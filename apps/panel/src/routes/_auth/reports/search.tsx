import { createFileRoute } from "@tanstack/react-router"
import { SearchReportPage } from "@/features/reports/pages/search-report-page"

export const Route = createFileRoute("/_auth/reports/search")({
  component: SearchReportPage,
})
