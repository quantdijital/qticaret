import { createFileRoute } from "@tanstack/react-router"
import { ChargebacksPage } from "@/features/orders/pages/chargebacks-page"

export const Route = createFileRoute("/_auth/orders/chargebacks")({
  component: ChargebacksPage,
})
