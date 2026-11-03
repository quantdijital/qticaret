import { createFileRoute } from "@tanstack/react-router"
import { PaymentLinksPage } from "@/features/payment-links/pages/payment-links-page"
import { paymentLinkSearchSchema } from "@/features/payment-links/search"

export const Route = createFileRoute("/_auth/payment-links/")({
  validateSearch: paymentLinkSearchSchema,
  component: PaymentLinksPage,
})
