import { createFileRoute } from "@tanstack/react-router"
import { PaymentLinkPage } from "@/features/payment-links/pages/payment-link-page"
import { paymentLinkPageSearchSchema } from "@/features/payment-links/search"

export const Route = createFileRoute("/_auth/payment-links/$id")({
  validateSearch: paymentLinkPageSearchSchema,
  component: PaymentLinkPage,
})
