import { createFileRoute } from "@tanstack/react-router"
import { WholesaleOrdersPage } from "@/features/wholesale/pages/wholesale-orders-page"
import { wholesaleOrderSearchSchema } from "@/features/wholesale/search"

export const Route = createFileRoute("/_auth/customers/wholesale/orders")({
  validateSearch: wholesaleOrderSearchSchema,
  component: WholesaleOrdersPage,
})
