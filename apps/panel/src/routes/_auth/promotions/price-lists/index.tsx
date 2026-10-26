import { createFileRoute } from "@tanstack/react-router"
import { PriceListsPage } from "@/features/price-lists/pages/price-lists-page"

export const Route = createFileRoute("/_auth/promotions/price-lists/")({
  component: PriceListsPage,
})
