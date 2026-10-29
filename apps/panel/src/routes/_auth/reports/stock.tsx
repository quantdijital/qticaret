import { createFileRoute } from "@tanstack/react-router"
import { StockReportPage } from "@/features/reports/pages/stock-report-page"

export const Route = createFileRoute("/_auth/reports/stock")({
  component: StockReportPage,
})
