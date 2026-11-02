import { createFileRoute } from "@tanstack/react-router"
import { GiftCardsPage } from "@/features/gift-cards/pages/gift-cards-page"
import { giftCardSearchSchema } from "@/features/gift-cards/search"

export const Route = createFileRoute("/_auth/promotions/gift-cards")({
  validateSearch: giftCardSearchSchema,
  component: GiftCardsPage,
})
