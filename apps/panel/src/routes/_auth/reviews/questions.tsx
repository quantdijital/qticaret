import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { REVIEW_STATUSES } from "@/features/reviews/api/reviews"
import { QuestionsPage } from "@/features/reviews/pages/questions-page"

export const Route = createFileRoute("/_auth/reviews/questions")({
  validateSearch: z.object({ status: z.enum(REVIEW_STATUSES).optional().catch(undefined) }),
  component: QuestionsPage,
})
