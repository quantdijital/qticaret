import { createFileRoute } from "@tanstack/react-router"
import { PaymentsPage } from "@/features/settings/pages/payments-page"

export const Route = createFileRoute("/_auth/settings/payments")({
  component: PaymentsPage,
})
