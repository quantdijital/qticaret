import { createFileRoute } from "@tanstack/react-router"
import { PromotionPage } from "@/features/promotions/pages/promotion-page"

export const Route = createFileRoute("/_auth/promotions/$id")({
  component: PromotionPage,
})
