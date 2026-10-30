import { createFileRoute } from "@tanstack/react-router"
import { invoiceSearchSchema } from "@/features/orders/invoice-search"
import { InvoicesPage } from "@/features/orders/pages/invoices-page"

export const Route = createFileRoute("/_auth/orders/invoices")({
  validateSearch: invoiceSearchSchema,
  component: InvoicesPage,
})
