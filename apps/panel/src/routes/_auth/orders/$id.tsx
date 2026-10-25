import { createFileRoute } from "@tanstack/react-router"
import { OrderDetailPage } from "@/features/orders/pages/order-detail-page"

export const Route = createFileRoute("/_auth/orders/$id")({
  component: OrderDetailPage,
})
