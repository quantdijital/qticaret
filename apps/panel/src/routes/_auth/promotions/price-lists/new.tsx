import { createFileRoute } from "@tanstack/react-router"
import { NewPriceListPage } from "@/features/price-lists/pages/price-list-page"

export const Route = createFileRoute("/_auth/promotions/price-lists/new")({
  component: NewPriceListPage,
})
