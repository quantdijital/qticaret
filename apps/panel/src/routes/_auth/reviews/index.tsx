import { createFileRoute } from "@tanstack/react-router"
import { ReviewsPage } from "@/features/reviews/pages/reviews-page"
import { reviewListSearchSchema } from "@/features/reviews/search"

export const Route = createFileRoute("/_auth/reviews/")({
  validateSearch: reviewListSearchSchema,
  component: ReviewsPage,
})
