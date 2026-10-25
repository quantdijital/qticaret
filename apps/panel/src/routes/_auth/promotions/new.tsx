import { createFileRoute } from "@tanstack/react-router"
import { NewPromotionPage } from "@/features/promotions/pages/promotion-page"

export const Route = createFileRoute("/_auth/promotions/new")({
  component: NewPromotionPage,
})
