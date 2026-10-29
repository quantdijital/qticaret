import { createFileRoute } from "@tanstack/react-router"
import { BrandReportPage } from "@/features/reports/pages/brand-report-page"

export const Route = createFileRoute("/_auth/reports/brands")({
  component: BrandReportPage,
})
