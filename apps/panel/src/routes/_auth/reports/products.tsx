import { createFileRoute } from "@tanstack/react-router"
import { ProductReportPage } from "@/features/reports/pages/product-report-page"

export const Route = createFileRoute("/_auth/reports/products")({
  component: ProductReportPage,
})
