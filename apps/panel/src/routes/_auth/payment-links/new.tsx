import { createFileRoute } from "@tanstack/react-router"
import { NewPaymentLinkPage } from "@/features/payment-links/pages/new-payment-link-page"
import { newPaymentLinkSearchSchema } from "@/features/payment-links/search"

export const Route = createFileRoute("/_auth/payment-links/new")({
  validateSearch: newPaymentLinkSearchSchema,
  component: NewPaymentLinkPage,
})
