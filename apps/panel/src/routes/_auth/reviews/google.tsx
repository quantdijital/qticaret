import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { GoogleReviewsPage } from "@/features/reviews/pages/google-reviews-page"

export const Route = createFileRoute("/_auth/reviews/google")({
  // `google`: the word Google's callback came back with, read once by the page (adr/0058)
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
    google: z.string().max(40).optional().catch(undefined),
  }),
  component: GoogleReviewsPage,
})
