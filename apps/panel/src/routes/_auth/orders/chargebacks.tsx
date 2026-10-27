import { createFileRoute } from "@tanstack/react-router"
import { chargebackSearchSchema } from "@/features/orders/chargeback-search"
import { ChargebacksPage } from "@/features/orders/pages/chargebacks-page"

export const Route = createFileRoute("/_auth/orders/chargebacks")({
  validateSearch: chargebackSearchSchema,
  component: ChargebacksPage,
})
