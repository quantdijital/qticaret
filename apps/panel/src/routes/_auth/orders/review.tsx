import { createFileRoute } from "@tanstack/react-router"
import { fraudSearchSchema } from "@/features/orders/fraud-search"
import { FraudReviewsPage } from "@/features/orders/pages/fraud-reviews-page"

export const Route = createFileRoute("/_auth/orders/review")({
  validateSearch: fraudSearchSchema,
  component: FraudReviewsPage,
})
