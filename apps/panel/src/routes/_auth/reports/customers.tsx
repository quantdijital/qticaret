import { createFileRoute } from "@tanstack/react-router"
import { CustomerReportPage } from "@/features/reports/pages/customer-report-page"

export const Route = createFileRoute("/_auth/reports/customers")({
  component: CustomerReportPage,
})
