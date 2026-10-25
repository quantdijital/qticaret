import { createFileRoute } from "@tanstack/react-router"
import { OrdersPage } from "@/features/orders/pages/orders-page"
import { orderListSearchSchema } from "@/features/orders/search"

export const Route = createFileRoute("/_auth/orders/")({
  validateSearch: orderListSearchSchema,
  component: OrdersPage,
})
