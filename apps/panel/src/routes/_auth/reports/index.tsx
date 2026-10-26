import { createFileRoute } from "@tanstack/react-router"
import { ReportSummaryPage } from "@/features/reports/pages/report-summary-page"

export const Route = createFileRoute("/_auth/reports/")({
  component: ReportSummaryPage,
})
