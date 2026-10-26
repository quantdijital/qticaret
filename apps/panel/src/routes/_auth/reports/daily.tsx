import { createFileRoute } from "@tanstack/react-router"
import { DailyReportPage } from "@/features/reports/pages/daily-report-page"

export const Route = createFileRoute("/_auth/reports/daily")({
  component: DailyReportPage,
})
