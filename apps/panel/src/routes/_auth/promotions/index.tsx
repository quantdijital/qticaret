import { createFileRoute } from "@tanstack/react-router"
import { PromotionsPage } from "@/features/promotions/pages/promotions-page"

export const Route = createFileRoute("/_auth/promotions/")({
  component: PromotionsPage,
})
