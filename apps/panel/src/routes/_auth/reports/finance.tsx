import { createFileRoute } from "@tanstack/react-router"
import { FinanceReportPage } from "@/features/reports/pages/finance-report-page"

export const Route = createFileRoute("/_auth/reports/finance")({
  component: FinanceReportPage,
})
