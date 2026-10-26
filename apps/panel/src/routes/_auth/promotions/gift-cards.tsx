import { createFileRoute } from "@tanstack/react-router"
import { GiftCardsPage } from "@/features/gift-cards/pages/gift-cards-page"

export const Route = createFileRoute("/_auth/promotions/gift-cards")({
  component: GiftCardsPage,
})
