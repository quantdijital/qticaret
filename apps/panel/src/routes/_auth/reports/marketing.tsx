import { createFileRoute } from "@tanstack/react-router"
import { MarketingReportPage } from "@/features/reports/pages/marketing-report-page"

export const Route = createFileRoute("/_auth/reports/marketing")({
  component: MarketingReportPage,
})
