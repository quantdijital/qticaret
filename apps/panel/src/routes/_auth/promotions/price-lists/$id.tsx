import { createFileRoute } from "@tanstack/react-router"
import { PriceListPage } from "@/features/price-lists/pages/price-list-page"

export const Route = createFileRoute("/_auth/promotions/price-lists/$id")({
  component: PriceListPage,
})
